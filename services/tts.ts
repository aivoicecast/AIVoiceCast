import { GoogleGenAI, Modality } from '@google/genai';
import { base64ToBytes, decodeRawPcm, getGlobalAudioContext, hashString } from '../utils/audioUtils';
import { getCachedAudioBuffer, cacheAudioBuffer } from '../utils/db';
import { OPENAI_API_KEY, GCP_API_KEY } from './private_keys';
import { auth, storage } from './firebaseConfig';
import { ref, getDownloadURL } from '@firebase/storage';

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
        if (lang === 'zh') {
            // HIGH-QUALITY CHIRP3-HD VOICES (Requires cmn-CN language code)
            if (isInterview) return 'cmn-CN-Chirp3-HD-Erinome'; 
            if (isLinux) return 'cmn-CN-Chirp3-HD-Erinome'; // Defaulting to Erinome for clarity
            return 'cmn-CN-Chirp3-HD-Erinome'; 
        }
        if (isInterview) return 'en-US-Wavenet-B';
        if (isLinux) return 'en-US-Wavenet-J';
        return 'en-US-Wavenet-D';
    } else {
        if (isInterview) return 'Fenrir';
        if (isLinux) return 'Puck';
        if (isDefaultGem) return 'Zephyr';
        if (lang === 'zh') return 'Kore'; 
        const validGemini = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
        return validGemini.includes(voiceName) ? voiceName : 'Puck';
    }
}

export function cleanTextForTTS(text: string): string {
  return text.replace(/`/g, '');
}

/**
 * PRODUCTION ENGINE: Google Cloud TTS with Multi-Stage Fallback
 */
async function synthesizeGoogleCloud(text: string, voiceId: string, lang: 'en' | 'zh', apiKey: string): Promise<ArrayBuffer> {
    const firstVoice = getValidVoiceName(voiceId, 'google', lang);
    
    // Priority Fallback List for Chinese and English
    // Note: cmn-CN models usually require 'cmn-CN' code, while Standard/Wavenet often use 'zh-CN'
    const fallbacks = lang === 'zh' 
        ? ['cmn-CN-Chirp3-HD-Erinome', 'zh-CN-Wavenet-A', 'zh-CN-Neural2-A', 'zh-CN-Standard-A', 'zh-CN-Standard-B']
        : ['en-US-Wavenet-D', 'en-US-Neural2-D', 'en-US-Standard-D', 'en-US-Standard-A', 'en-US-Standard-B'];

    const attempt = async (voiceName: string) => {
        // Detect correct language code based on voice prefix
        let requestLangCode = lang === 'zh' ? 'zh-CN' : 'en-US';
        if (voiceName.startsWith('cmn-')) requestLangCode = 'cmn-CN';

        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text },
                voice: { 
                  languageCode: requestLangCode, 
                  name: voiceName
                },
                audioConfig: { 
                  audioEncoding: 'LINEAR16', 
                  sampleRateHertz: 24000
                }
            })
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const msg = errData.error?.message || response.statusText;
            throw { status: response.status, message: msg, voice: voiceName };
        }
        const data = await response.json();
        return base64ToBytes(data.audioContent).buffer;
    };

    try {
        return await attempt(firstVoice);
    } catch (e: any) {
        // CYCLICAL FALLBACK: Try all voices in the fallback chain until one hits
        if (e.status === 400 && (e.message.includes("does not exist") || e.message.includes("not enabled") || e.message.includes("language code"))) {
            console.warn(`[TTS] Premium Voice ${e.voice} failed. Starting fallback chain...`);
            
            for (const fallback of fallbacks) {
                if (fallback === e.voice) continue;
                try {
                    console.log(`[TTS] Attempting fallback: ${fallback}`);
                    return await attempt(fallback);
                } catch (innerE: any) {
                    console.warn(`[TTS] Fallback ${fallback} failed: ${innerE.message}`);
                }
            }
        }
        throw new Error(`VOICE_NOT_FOUND|400|All mapped GCP voices (including ${firstVoice}) are disabled in your project. Please enable 'Cloud Text-to-Speech API' and ensure your project supports Chirp/Wavenet models.`);
    }
}

async function synthesizeOpenAI(text: string, voice: string, apiKey: string): Promise<ArrayBuffer> {
  const targetVoice = getValidVoiceName(voice, 'openai');
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", input: text, voice: targetVoice }),
  });
  if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error?.message || response.statusText;
      throw new Error(`OPENAI_ERROR|${response.status}|${msg}`);
  }
  return await response.arrayBuffer();
}

async function synthesizeGemini(text: string, voice: string, lang: 'en' | 'zh' = 'en'): Promise<ArrayBuffer> {
    const targetVoice = getValidVoiceName(voice, 'gemini', lang);
    const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) || '' });
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
        if (!base64) {
            const reason = response.candidates?.[0]?.finishReason;
            throw new Error(`GEMINI_ERROR|EMPTY|FinishReason: ${reason || 'Unknown'}`);
        }
        return base64ToBytes(base64).buffer;
    } catch (e: any) {
        let msg = e.message;
        if (msg.includes('requests_per_model_per_day') || msg.includes('limit: 0')) {
            throw new Error(`DAILY_LIMIT_EXHAUSTED|429|Gemini TTS daily quota reached.`);
        }
        if (msg.includes('429')) msg = `RATE_LIMIT|429|Requests too fast.`;
        throw new Error(`GEMINI_ERROR|API|${msg}`);
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
  audioContext: AudioContext,
  preferredProvider: TtsProvider = 'google',
  lang: 'en' | 'zh' = 'en',
  customApiKey?: string
): Promise<TtsResult> {
  const cleanText = cleanTextForTTS(text);
  const cacheKey = `${preferredProvider}:${voiceName}:${lang}:${cleanText}`;
  
  if (memoryCache.has(cacheKey)) return { buffer: memoryCache.get(cacheKey)!, errorType: 'none', provider: preferredProvider };
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const requestPromise = (async (): Promise<TtsResult> => {
    try {
      const cached = await getCachedAudioBuffer(cacheKey);
      if (cached) {
        const isLinear = preferredProvider === 'google' || preferredProvider === 'gemini';
        const audioBuffer = isLinear 
            ? await decodeRawPcm(new Uint8Array(cached), audioContext, 24000)
            : await audioContext.decodeAudioData(cached.slice(0));
            
        memoryCache.set(cacheKey, audioBuffer);
        return { buffer: audioBuffer, errorType: 'none', provider: preferredProvider };
      }

      if (preferredProvider === 'system') return { buffer: null, errorType: 'none', provider: 'system' };

      const cloudBuffer = await checkCloudCache(cacheKey);
      if (cloudBuffer) {
          await cacheAudioBuffer(cacheKey, cloudBuffer);
          const isLinear = preferredProvider === 'google' || preferredProvider === 'gemini';
          const audioBuffer = isLinear 
              ? await decodeRawPcm(new Uint8Array(cloudBuffer), audioContext, 24000)
              : await audioContext.decodeAudioData(cloudBuffer.slice(0));
          memoryCache.set(cacheKey, audioBuffer);
          return { buffer: audioBuffer, errorType: 'none', provider: preferredProvider };
      }

      let rawBuffer: ArrayBuffer;
      const openAiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || '';
      const googleKey = customApiKey || GCP_API_KEY || (process.env.API_KEY as string) || '';
      
      if (preferredProvider === 'openai' && openAiKey) {
          rawBuffer = await synthesizeOpenAI(cleanText, voiceName, openAiKey);
      } else if (preferredProvider === 'google' && googleKey) {
          rawBuffer = await synthesizeGoogleCloud(cleanText, voiceName, lang, googleKey);
      } else {
          rawBuffer = await synthesizeGemini(cleanText, voiceName, lang);
      }

      await cacheAudioBuffer(cacheKey, rawBuffer);
      
      const isLinear = preferredProvider === 'google' || preferredProvider === 'gemini';
      const audioBuffer = isLinear 
          ? await decodeRawPcm(new Uint8Array(rawBuffer), audioContext, 24000)
          : await audioContext.decodeAudioData(rawBuffer.slice(0));
      
      memoryCache.set(cacheKey, audioBuffer);
      return { buffer: audioBuffer, errorType: 'none', provider: preferredProvider };
    } catch (error: any) {
      console.error("TTS Pipeline Error:", error);
      const isDaily = error.message?.includes('DAILY_LIMIT_EXHAUSTED');
      const isRate = error.message?.includes('RATE_LIMIT') || error.message?.includes('429');
      const isVoiceNotFound = error.message?.includes('VOICE_NOT_FOUND');
      
      return { 
        buffer: null, 
        errorType: isDaily ? 'daily_limit' : (isVoiceNotFound ? 'voice_not_found' : (isRate ? 'quota' : 'unknown')), 
        errorMessage: error.message || String(error), 
        provider: preferredProvider 
      };
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}