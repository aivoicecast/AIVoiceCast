
import { GoogleGenAI, Modality } from '@google/genai';
import { base64ToBytes, decodeRawPcm, getGlobalAudioContext, hashString } from '../utils/audioUtils';
import { getCachedAudioBuffer, cacheAudioBuffer } from '../utils/db';
import { auth, storage } from './firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';
import { resolvePersona } from '../utils/aiRegistry';

export type TtsErrorType = 'none' | 'quota' | 'network' | 'unknown' | 'auth';

export interface TtsResult {
  buffer: AudioBuffer | null;
  errorType: TtsErrorType;
  errorMessage?: string;
  provider?: 'gemini' | 'openai' | 'system';
}

const memoryCache = new Map<string, AudioBuffer>();
const pendingRequests = new Map<string, Promise<TtsResult>>();

export function cleanTextForTTS(text: string): string {
  return text.replace(/`/g, '');
}

export function clearMemoryCache() {
  memoryCache.clear();
  pendingRequests.clear();
}
export const clearAudioCache = clearMemoryCache;

async function synthesizeGemini(text: string, voice: string): Promise<ArrayBuffer> {
    const persona = resolvePersona(voice);
    
    // CRITICAL: New instance to use selected key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO], 
                speechConfig: { 
                    voiceConfig: { 
                        prebuiltVoiceConfig: { voiceName: persona.liveVoice } 
                    } 
                },
            },
        });
        const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64) throw new Error("Empty Gemini Audio");
        return base64ToBytes(base64).buffer;
    } catch (e: any) {
        if (e.message?.includes("Requested entity was not found") && (window as any).aistudio) {
            (window as any).aistudio.openSelectKey();
        }
        throw e;
    }
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
  audioContext: AudioContext
): Promise<TtsResult> {
  const cleanText = cleanTextForTTS(text);
  const cacheKey = `${voiceName}:${cleanText}`;
  
  if (memoryCache.has(cacheKey)) return { buffer: memoryCache.get(cacheKey)!, errorType: 'none' };
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const requestPromise = (async (): Promise<TtsResult> => {
    try {
      const cached = await getCachedAudioBuffer(cacheKey);
      if (cached) {
        const audioBuffer = await decodeRawPcm(new Uint8Array(cached), audioContext, 24000);
        memoryCache.set(cacheKey, audioBuffer);
        return { buffer: audioBuffer, errorType: 'none' };
      }

      const cloudBuffer = await checkCloudCache(cacheKey);
      if (cloudBuffer) {
          await cacheAudioBuffer(cacheKey, cloudBuffer);
          const audioBuffer = await decodeRawPcm(new Uint8Array(cloudBuffer), audioContext, 24000);
          memoryCache.set(cacheKey, audioBuffer);
          return { buffer: audioBuffer, errorType: 'none' };
      }

      const rawBuffer = await synthesizeGemini(cleanText, voiceName);
      await cacheAudioBuffer(cacheKey, rawBuffer);
      const audioBuffer = await decodeRawPcm(new Uint8Array(rawBuffer), audioContext, 24000);
      
      memoryCache.set(cacheKey, audioBuffer);
      return { buffer: audioBuffer, errorType: 'none', provider: 'gemini' };
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
