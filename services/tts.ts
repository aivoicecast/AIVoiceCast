
import { GoogleGenAI, Modality } from '@google/genai';
import { base64ToBytes, decodeRawPcm, getGlobalAudioContext } from '../utils/audioUtils';
import { getCachedAudioBuffer, cacheAudioBuffer } from '../utils/db';
import { auth } from './firebaseConfig';
import { deductCoins, AI_COSTS, saveAudioToLedger, getScriptureAudioUrl } from './firestoreService';

export type TtsErrorType = 'none' | 'quota' | 'daily_limit' | 'network' | 'unknown' | 'auth' | 'unsupported' | 'voice_not_found';
export type TtsProvider = 'gemini' | 'google' | 'openai' | 'system';

export interface TtsResult {
  buffer: AudioBuffer | null;
  rawBuffer?: ArrayBuffer; 
  dataUrl?: string; 
  errorType: TtsErrorType;
  errorMessage?: string;
  provider?: TtsProvider;
  mime?: string;
}

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
        return 'nova';
    } else if (provider === 'google') {
        if (lang === 'zh') return 'cmn-CN-Wavenet-A'; 
        if (isInterview) return 'en-US-Wavenet-B';
        if (isLinux) return 'en-US-Wavenet-J';
        return 'en-US-Wavenet-D';
    } else {
        // Gemini Native Voices
        if (isInterview) return 'Fenrir';
        if (isLinux) return 'Puck';
        if (isDefaultGem) return 'Zephyr';
        if (lang === 'zh') return 'Kore'; 
        return 'Puck';
    }
}

async function synthesizeGemini(text: string, voice: string, lang: 'en' | 'zh' = 'en'): Promise<{buffer: ArrayBuffer, mime: string}> {
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
        return { buffer: base64ToBytes(base64).buffer, mime: 'audio/pcm;rate=24000' };
    } catch (e: any) {
        throw new Error(`GEMINI_ERROR|API|${e.message}`);
    }
}

async function synthesizeOpenAI(text: string, voice: string): Promise<{buffer: ArrayBuffer, mime: string}> {
    const apiKey = localStorage.getItem('openai_api_key') || process.env.OPENAI_API_KEY || '';
    if (!apiKey) throw new Error("OPENAI_KEY_MISSING");
    
    const targetVoice = getValidVoiceName(voice, 'openai');
    
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "tts-1",
            input: text,
            voice: targetVoice
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OPENAI_ERROR|${error.error?.message || response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return { buffer: arrayBuffer, mime: 'audio/mpeg' };
}

/**
 * World-Class TTS Refraction Engine
 */
export async function synthesizeSpeech(
  text: string, 
  voiceName: string, 
  audioContext: AudioContext,
  preferredProvider: TtsProvider = 'google',
  lang: 'en' | 'zh' = 'en',
  metadata?: { book: string, chapter: string, verse: string }
): Promise<TtsResult> {
  const cleanText = text.replace(/`/g, '').trim();
  const cacheKey = `${preferredProvider}:${voiceName}:${lang}:${cleanText}`;
  
  if (memoryCache.has(cacheKey)) return { buffer: memoryCache.get(cacheKey)!, errorType: 'none', provider: preferredProvider };
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const requestPromise = (async (): Promise<TtsResult> => {
    try {
      // 1. Check Local Cache
      const localCached = await getCachedAudioBuffer(cacheKey);
      if (localCached) {
        const audioBuffer = await audioContext.decodeAudioData(localCached.slice(0)).catch(() => decodeRawPcm(new Uint8Array(localCached), audioContext, 24000, 1));
        memoryCache.set(cacheKey, audioBuffer);
        return { buffer: audioBuffer, rawBuffer: localCached, errorType: 'none', provider: preferredProvider };
      }

      // 2. Check Global Ledger
      if (metadata) {
          const ledgerUrl = await getScriptureAudioUrl(metadata.book, metadata.chapter, metadata.verse, lang);
          if (ledgerUrl) {
              const response = await fetch(ledgerUrl);
              const arrayBuffer = await response.arrayBuffer();
              const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0)).catch(() => decodeRawPcm(new Uint8Array(arrayBuffer), audioContext, 24000, 1));
              await cacheAudioBuffer(cacheKey, arrayBuffer);
              memoryCache.set(cacheKey, audioBuffer);
              return { buffer: audioBuffer, rawBuffer: arrayBuffer, errorType: 'none', provider: preferredProvider };
          }
      }

      // 3. Synthesis Phase
      let rawBuffer: ArrayBuffer;
      let mimeType = 'audio/mpeg'; 
      
      if (preferredProvider === 'google') {
          const googleKey = process.env.API_KEY || '';
          const firstVoice = getValidVoiceName(voiceName, 'google', lang);
          const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text: cleanText },
                voice: { languageCode: lang === 'zh' ? 'zh-CN' : 'en-US', name: firstVoice },
                audioConfig: { 
                    audioEncoding: 'MP3', 
                    speakingRate: 1.0,
                    pitch: 0,
                    sampleRateHertz: 24000 
                }
            })
          });
          if (!response.ok) throw new Error(`GCP_ERROR|${response.status}`);
          const data = await response.json();
          rawBuffer = base64ToBytes(data.audioContent).buffer;
      } else if (preferredProvider === 'openai') {
          const res = await synthesizeOpenAI(cleanText, voiceName);
          rawBuffer = res.buffer;
          mimeType = res.mime;
      } else {
          // GEMINI PREVIEW PROVIDER
          const gemRes = await synthesizeGemini(cleanText, voiceName, lang);
          rawBuffer = gemRes.buffer;
          mimeType = gemRes.mime;
      }

      // 4. Update Sovereign Ledger
      if (auth.currentUser) {
          deductCoins(auth.currentUser.uid, AI_COSTS.AUDIO_SYNTHESIS);
          if (metadata) {
              await saveAudioToLedger(metadata.book, metadata.chapter, metadata.verse, lang, new Uint8Array(rawBuffer), mimeType);
          }
      }

      await cacheAudioBuffer(cacheKey, rawBuffer);
      const audioBuffer = await audioContext.decodeAudioData(rawBuffer.slice(0)).catch(() => decodeRawPcm(new Uint8Array(rawBuffer), audioContext, 24000, 1));

      memoryCache.set(cacheKey, audioBuffer);
      return { buffer: audioBuffer, rawBuffer, mime: mimeType, errorType: 'none', provider: preferredProvider };
    } catch (error: any) {
      console.error("TTS Fault:", error);
      return { buffer: null, errorType: 'quota', errorMessage: error.message, provider: 'system' };
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}
