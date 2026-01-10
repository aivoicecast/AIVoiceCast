import { GoogleGenAI, Modality } from '@google/genai';
import { base64ToBytes, decodeRawPcm, getGlobalAudioContext, hashString } from '../utils/audioUtils';
import { getCachedAudioBuffer, cacheAudioBuffer } from '../utils/db';
import { OPENAI_API_KEY } from './private_keys';
import { auth, storage } from './firebaseConfig';
// FIXED: Using @firebase/ scoped packages
import { ref, getDownloadURL } from '@firebase/storage';

export type TtsErrorType = 'none' | 'quota' | 'network' | 'unknown' | 'auth';

export interface TtsResult {
  buffer: AudioBuffer | null;
  errorType: TtsErrorType;
  errorMessage?: string;
  provider?: 'gemini' | 'openai' | 'system';
}

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
const memoryCache = new Map<string, AudioBuffer>();
const pendingRequests = new Map<string, Promise<TtsResult>>();

function getValidVoiceName(voiceName: string, provider: 'gemini' | 'openai'): string {
    const isInterview = voiceName.includes('0648937375') || voiceName === 'Software Interview Voice';
    const isLinux = voiceName.includes('0375218270') || voiceName === 'Linux Kernel Voice';
    const isDefaultGem = voiceName.toLowerCase().includes('gem') || voiceName === 'Default Gem';

    if (provider === 'openai') {
        if (isInterview) return 'onyx';
        if (isLinux) return 'alloy';
        if (isDefaultGem) return 'nova';
        return OPENAI_VOICES.includes(voiceName.toLowerCase()) ? voiceName.toLowerCase() : 'alloy';
    } else {
        if (isInterview) return 'Fenrir';
        if (isLinux) return 'Puck';
        if (isDefaultGem) return 'Zephyr';
        const validGemini = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
        return validGemini.includes(voiceName) ? voiceName : 'Puck';
    }
}

export function cleanTextForTTS(text: string): string {
  return text.replace(/`/g, '');
}

export function clearMemoryCache() {
  memoryCache.clear();
  pendingRequests.clear();
}
export const clearAudioCache = clearMemoryCache;

async function synthesizeOpenAI(text: string, voice: string, apiKey: string): Promise<ArrayBuffer> {
  const targetVoice = getValidVoiceName(voice, 'openai');
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", input: text, voice: targetVoice }),
  });
  if (!response.ok) throw new Error("OpenAI TTS Error");
  return await response.arrayBuffer();
}

async function synthesizeGemini(text: string, voice: string): Promise<ArrayBuffer> {
    const targetVoice = getValidVoiceName(voice, 'gemini');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: targetVoice } } },
        },
    });
    const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64) throw new Error("Empty Gemini Audio");
    return base64ToBytes(base64).buffer;
}

async function checkCloudCache(cacheKey: string): Promise<ArrayBuffer | null> {
    if (!auth?.currentUser || !storage) return null;
    
    try {
        const hash = await hashString(cacheKey);
        const uid = auth.currentUser.uid;
        const cloudPath = `backups/${uid}/audio/${hash}`;
        const url = await getDownloadURL(ref(storage, cloudPath));
        const response = await fetch(url);
        if (response.ok) return await response.arrayBuffer();
    } catch (e) {}
    return null;
}

export async function synthesizeSpeech(
  text: string, 
  voiceName: string, 
  audioContext: AudioContext,
  preferredProvider?: 'gemini' | 'openai' | 'system'
): Promise<TtsResult> {
  const cleanText = cleanTextForTTS(text);
  const cacheKey = `${voiceName}:${cleanText}`;
  
  if (memoryCache.has(cacheKey)) return { buffer: memoryCache.get(cacheKey)!, errorType: 'none' };
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const requestPromise = (async (): Promise<TtsResult> => {
    try {
      const cached = await getCachedAudioBuffer(cacheKey);
      if (cached) {
        const isHighQuality = OPENAI_VOICES.some(v => voiceName.toLowerCase().includes(v)) 
                  || voiceName.includes('06489') 
                  || voiceName.includes('03752')
                  || voiceName.toLowerCase().includes('gem');
                  
        const audioBuffer = isHighQuality 
            ? await audioContext.decodeAudioData(cached.slice(0)) 
            : await decodeRawPcm(new Uint8Array(cached), audioContext, 24000);
        memoryCache.set(cacheKey, audioBuffer);
        return { buffer: audioBuffer, errorType: 'none' };
      }

      if (preferredProvider === 'system') return { buffer: null, errorType: 'none', provider: 'system' };

      const cloudBuffer = await checkCloudCache(cacheKey);
      if (cloudBuffer) {
          await cacheAudioBuffer(cacheKey, cloudBuffer);
          const audioBuffer = await audioContext.decodeAudioData(cloudBuffer.slice(0));
          memoryCache.set(cacheKey, audioBuffer);
          return { buffer: audioBuffer, errorType: 'none' };
      }

      let rawBuffer: ArrayBuffer;
      let usedProvider: 'gemini' | 'openai' = 'gemini';
      const openAiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
      
      if (preferredProvider === 'openai' && openAiKey) {
          usedProvider = 'openai';
          rawBuffer = await synthesizeOpenAI(cleanText, voiceName, openAiKey);
      } else {
          usedProvider = 'gemini';
          rawBuffer = await synthesizeGemini(cleanText, voiceName);
      }

      await cacheAudioBuffer(cacheKey, rawBuffer);
      const audioBuffer = usedProvider === 'openai' 
          ? await audioContext.decodeAudioData(rawBuffer.slice(0)) 
          : await decodeRawPcm(new Uint8Array(rawBuffer), audioContext, 24000);
      
      memoryCache.set(cacheKey, audioBuffer);
      return { buffer: audioBuffer, errorType: 'none', provider: usedProvider };
    } catch (error: any) {
      console.error("TTS Pipeline Error:", error);
      return { buffer: null, errorType: 'unknown', errorMessage: error.message };
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}