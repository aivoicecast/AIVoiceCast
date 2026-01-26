
import { GoogleGenAI, Modality } from '@google/genai';
import { base64ToBytes, decodeRawPcm, getGlobalAudioContext } from '../utils/audioUtils';
import { getCachedAudioBuffer, cacheAudioBuffer } from '../utils/db';
import { OPENAI_API_KEY, GCP_API_KEY } from './private_keys';
import { auth } from './firebaseConfig';
import { deductCoins, AI_COSTS } from './firestoreService';
import { logger } from './logger';

export type TtsErrorType = 'none' | 'quota' | 'daily_limit' | 'network' | 'unknown' | 'auth' | 'unsupported' | 'voice_not_found';
export type TtsProvider = 'gemini' | 'google' | 'openai' | 'system';

export interface TtsResult {
  buffer: AudioBuffer | null;
  errorType: TtsErrorType;
  errorMessage?: string;
  provider?: TtsProvider;
}

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
const memoryCache = new Map<string, AudioBuffer>();
const pendingRequests = new Map<string, Promise<TtsResult>>();

function getValidVoiceName(voiceName: string, provider: TtsProvider, lang: 'en' | 'zh' = 'en'): string {
    const name = voiceName.toLowerCase();
    const isInterview = name.includes('0648937375') || name.includes('software interview');
    const isLinux = name.includes('0375218270') || name.includes('linux kernel');
    const isDefaultGem = name.includes('gem') || name.includes('default');

    if (provider === 'openai') {
        if (isInterview) return 'onyx';
        if (isLinux) return 'alloy';
        if (isDefaultGem) return 'nova';
        return OPENAI_VOICES.includes(name) ? name : 'alloy';
    } else if (provider === 'google') {
        if (lang === 'zh') return 'cmn-CN-Chirp3-HD-Erinome'; 
        if (isInterview) return 'en-US-Wavenet-B';
        if (isLinux) return 'en-US-Wavenet-J';
        return 'en-US-Wavenet-D';
    } else {
        if (isInterview) return 'Fenrir';
        if (isLinux) return 'Puck';
        if (isDefaultGem) return 'Zephyr';
        if (lang === 'zh') return 'Kore'; 
        const validGemini = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
        for (const v of validGemini) { if (voiceName.includes(v)) return v; }
        return 'Puck';
    }
}

async function synthesizeGemini(text: string, voice: string, lang: 'en' | 'zh' = 'en'): Promise<ArrayBuffer> {
    const targetVoice = getValidVoiceName(voice, 'gemini', lang);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text }] }],
            config: {
              responseModalities: [Modality.AUDIO], 
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: targetVoice } } },
            },
        });
        const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64) throw new Error(`GEMINI_ERROR|EMPTY`);
        return base64ToBytes(base64).buffer;
    } catch (e: any) {
        throw new Error(`GEMINI_ERROR|API|${e.message}`);
    }
}

export async function synthesizeSpeech(
  text: string, 
  voiceName: string, 
  audioContext: AudioContext,
  preferredProvider: TtsProvider = 'google',
  lang: 'en' | 'zh' = 'en',
  customApiKey?: string
): Promise<TtsResult> {
  const cleanText = text.replace(/`/g, '');
  const cacheKey = `${preferredProvider}:${voiceName}:${lang}:${cleanText}`;
  
  if (memoryCache.has(cacheKey)) return { buffer: memoryCache.get(cacheKey)!, errorType: 'none', provider: preferredProvider };
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const requestPromise = (async (): Promise<TtsResult> => {
    try {
      const cached = await getCachedAudioBuffer(cacheKey);
      if (cached) {
        const audioBuffer = await decodeRawPcm(new Uint8Array(cached), audioContext, 24000);
        memoryCache.set(cacheKey, audioBuffer);
        return { buffer: audioBuffer, errorType: 'none', provider: preferredProvider };
      }

      let rawBuffer: ArrayBuffer;
      const openAiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || '';
      const googleKey = customApiKey || GCP_API_KEY || process.env.API_KEY || '';
      
      if (preferredProvider === 'openai' && openAiKey) {
          const response = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "tts-1", input: cleanText, voice: getValidVoiceName(voiceName, 'openai') }),
          });
          if (!response.ok) throw new Error(`OPENAI_ERROR|${response.status}`);
          rawBuffer = await response.arrayBuffer();
      } else if (preferredProvider === 'google' && googleKey) {
          const firstVoice = getValidVoiceName(voiceName, 'google', lang);
          const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text: cleanText },
                voice: { languageCode: lang === 'zh' ? 'zh-CN' : 'en-US', name: firstVoice },
                audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000 }
            })
          });
          if (!response.ok) throw new Error(`GCP_ERROR|${response.status}`);
          const data = await response.json();
          rawBuffer = base64ToBytes(data.audioContent).buffer;
      } else {
          rawBuffer = await synthesizeGemini(cleanText, voiceName, lang);
      }

      if (auth.currentUser) deductCoins(auth.currentUser.uid, AI_COSTS.AUDIO_SYNTHESIS);
      await cacheAudioBuffer(cacheKey, rawBuffer);
      
      const audioBuffer = await decodeRawPcm(new Uint8Array(rawBuffer), audioContext, 24000);
      memoryCache.set(cacheKey, audioBuffer);
      return { buffer: audioBuffer, errorType: 'none', provider: preferredProvider };
    } catch (error: any) {
      return { buffer: null, errorType: 'quota', errorMessage: error.message, provider: 'system' };
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}
