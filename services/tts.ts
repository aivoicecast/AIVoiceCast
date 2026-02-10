
import { GoogleGenAI, Modality } from '@google/genai';
import { base64ToBytes, decodeRawPcm, getGlobalAudioContext, hashString, syncPrimeSpeech, connectOutput, SPEECH_REGISTRY, getSystemVoicesAsync } from '../utils/audioUtils';
import { getCachedAudioBuffer, cacheAudioBuffer } from '../utils/db';
import { auth } from './firebaseConfig';
import { deductCoins, AI_COSTS, saveAudioToLedger, getCloudAudioUrl, getUserProfile } from './firestoreService';
import { OPENAI_API_KEY, GCP_API_KEY, GEMINI_API_KEY } from './private_keys';

export type TtsProvider = 'gemini' | 'google' | 'system' | 'openai';
export type TtsErrorType = 'none' | 'quota' | 'daily_limit' | 'network' | 'unknown' | 'auth' | 'unsupported' | 'voice_not_found';

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

function dispatchLog(text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
    window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: text, type } }));
}

/**
 * Sanitizes the API key to ensure it is trimmed and not a placeholder.
 */
function getSanitizedKey(key?: string): string {
    const raw = (key || '').trim();
    if (!raw || raw === 'YOUR_GEMINI_API_KEY_HERE' || raw === 'YOUR_BASE_API_KEY') {
        return '';
    }
    return raw;
}

function getValidVoiceName(voiceName: string, provider: TtsProvider, lang: 'en' | 'zh' = 'en'): string {
    const name = (voiceName || '').toLowerCase();
    const isInterview = name.includes('0648937375') || name.includes('software interview');
    const isLinux = name.includes('0375218270') || name.includes('linux kernel');

    if (provider === 'google') {
        if (lang === 'zh') return 'cmn-CN-Wavenet-A'; 
        if (isInterview) return 'en-US-Wavenet-B';
        if (isLinux) return 'en-US-Wavenet-J';
        return 'en-US-Wavenet-D';
    } else if (provider === 'openai') {
        return 'nova';
    } else {
        if (lang === 'zh') return 'Kore'; 
        if (isInterview) return 'Fenrir';
        if (isLinux) return 'Puck';
        return 'Zephyr';
    }
}

async function synthesizeGemini(text: string, voice: string, lang: 'en' | 'zh' = 'en', apiKey?: string): Promise<{buffer: ArrayBuffer, mime: string}> {
    const targetVoice = getValidVoiceName(voice, 'gemini', lang);
    
    // Check multiple potential sources for the key
    const sources = [
        getSanitizedKey(apiKey),
        getSanitizedKey(GEMINI_API_KEY),
        getSanitizedKey(process.env.API_KEY)
    ];
    
    const key = sources.find(k => k.length > 0);
    
    if (!key) {
        throw new Error("API_KEY_INVALID: Gemini API Key missing or set to placeholder.");
    }

    const ai = new GoogleGenAI({ apiKey: key });
    
    let cleanText = text.replace(/[*_#`\[\]()<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    const hasChinese = /[\u4e00-\u9fa5]/.test(cleanText);
    let ttsPrompt = cleanText;
    if (lang === 'zh' && hasChinese) {
        ttsPrompt = `Chinese: ${cleanText}`;
    }

    dispatchLog(`Handshaking Gemini 2.5 Flash TTS...`, 'info');
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text: ttsPrompt }] }],
            config: {
                responseModalities: [Modality.AUDIO], 
                speechConfig: { 
                    voiceConfig: { 
                        prebuiltVoiceConfig: { voiceName: targetVoice } 
                    } 
                }
            },
        });
        
        const candidate = response.candidates?.[0];
        const audioPart = candidate?.content?.parts?.find(p => p.inlineData?.data);
        
        if (audioPart?.inlineData?.data) {
            dispatchLog(`Gemini Payload Received: ${Math.round(audioPart.inlineData.data.length / 1024)}KB.`, 'success');
            return { 
                buffer: base64ToBytes(audioPart.inlineData.data).buffer, 
                mime: 'audio/pcm;rate=24000' 
            };
        }
        throw new Error("Empty candidate part. Check API Key quotas or safety filters.");
    } catch (e: any) {
        throw e;
    }
}

async function synthesizeGoogle(text: string, voice: string, lang: 'en' | 'zh' = 'en', apiKey?: string): Promise<{buffer: ArrayBuffer, mime: string}> {
    const sources = [
        getSanitizedKey(apiKey),
        getSanitizedKey(GCP_API_KEY),
        getSanitizedKey(process.env.API_KEY)
    ];
    const key = sources.find(k => k.length > 0);
    
    if (!key) throw new Error("API_KEY_INVALID: Google Cloud API Key missing.");

    const targetVoice = getValidVoiceName(voice, 'google', lang);
    dispatchLog(`Dispatching to Google Cloud TTS (${targetVoice})...`, 'info');
    
    const body = {
        input: { text },
        voice: { languageCode: lang === 'zh' ? 'cmn-CN' : 'en-US', name: targetVoice },
        audioConfig: { audioEncoding: 'MP3' }
    };

    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status} ${res.statusText}` } }));
        if (res.status === 400 || res.status === 403) throw new Error("API_KEY_INVALID: " + (err.error?.message || "Auth error"));
        throw new Error(err.error?.message || "Cloud TTS Handshake Failed");
    }

    const data = await res.json();
    dispatchLog(`Cloud MP3 Payload Received.`, 'success');
    return { buffer: base64ToBytes(data.audioContent).buffer, mime: 'audio/mpeg' };
}

async function synthesizeOpenAI(text: string, voice: string, lang: 'en' | 'zh' = 'en', apiKey?: string): Promise<{buffer: ArrayBuffer, mime: string}> {
    const sources = [
        getSanitizedKey(apiKey),
        getSanitizedKey(OPENAI_API_KEY)
    ];
    const key = sources.find(k => k.length > 0);
    
    if (!key) throw new Error("API_KEY_INVALID: OpenAI API Key missing.");
    
    dispatchLog(`Dispatching to OpenAI Whisper-TTS (nova)...`, 'info');
    
    const res = await fetch(`https://api.openai.com/v1/audio/speech`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "tts-1",
            input: text,
            voice: "nova"
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status} ${res.statusText}` } }));
        if (res.status === 401 || res.status === 403) throw new Error("API_KEY_INVALID: OpenAI Auth failed.");
        throw new Error(err.error?.message || "OpenAI Handshake Failed");
    }

    const arrayBuffer = await res.arrayBuffer();
    dispatchLog(`OpenAI Audio Spectrum Received.`, 'success');
    return { buffer: arrayBuffer, mime: 'audio/mpeg' };
}

export async function speakSystem(text: string, lang: 'en' | 'zh' = 'en'): Promise<void> {
    const synth = window.speechSynthesis;
    if (!synth) {
        dispatchLog("Speech API missing.", "error");
        return;
    }
    
    if (synth.speaking || synth.pending) {
        synth.cancel();
        await new Promise(r => setTimeout(r, 200)); 
    }
    
    synth.resume();
    const cleanText = text.replace(/[*_#`\[\]()<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanText) return;

    const voices = await getSystemVoicesAsync();

    return new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
        const bestVoice = lang === 'zh' 
            ? voices.find(v => v.lang.includes('zh') || v.lang.includes('cmn')) 
            : voices.find(v => v.lang.includes('en'));
        if (bestVoice) utterance.voice = bestVoice;

        SPEECH_REGISTRY.add(utterance);
        let started = false;
        const startTimer = setTimeout(() => {
            if (!started) {
                synth.pause();
                setTimeout(() => synth.resume(), 50);
            }
        }, 1500);

        utterance.onstart = () => { started = true; clearTimeout(startTimer); };
        utterance.onend = () => { SPEECH_REGISTRY.delete(utterance); resolve(); };
        utterance.onerror = () => { SPEECH_REGISTRY.delete(utterance); synth.resume(); resolve(); };

        synth.speak(utterance);
        synth.pause();
        setTimeout(() => synth.resume(), 10);
    });
}

export async function synthesizeSpeech(
  text: string, 
  voiceName: string, 
  audioContext: AudioContext,
  preferredProvider: TtsProvider = 'system',
  lang: 'en' | 'zh' = 'en',
  metadata?: { channelId: string, topicId: string, nodeId?: string },
  apiKeyOverride?: string
): Promise<TtsResult> {
  if (preferredProvider === 'system') return { buffer: null, errorType: 'none', provider: 'system' };

  const cleanText = text.replace(/`/g, '').trim();
  const textFingerprint = await hashString(`${voiceName}:${lang}:${cleanText}`);
  const cacheKey = `${preferredProvider}:${voiceName}:${lang}:${textFingerprint}`;
  
  if (memoryCache.has(cacheKey)) return { buffer: memoryCache.get(cacheKey)!, errorType: 'none', provider: preferredProvider };
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const requestPromise = (async (): Promise<TtsResult> => {
    try {
      const localCached = await getCachedAudioBuffer(cacheKey);
      if (localCached) {
        const audioBuffer = await safeDecode(localCached, audioContext, preferredProvider === 'gemini');
        memoryCache.set(cacheKey, audioBuffer);
        return { buffer: audioBuffer, rawBuffer: localCached, errorType: 'none', provider: preferredProvider };
      }

      let finalOpenAIKey = apiKeyOverride;
      let finalGCPKey = apiKeyOverride;
      let finalGeminiKey = apiKeyOverride;

      if (!apiKeyOverride && auth?.currentUser) {
          const profile = await getUserProfile(auth.currentUser.uid);
          if (profile) {
              finalOpenAIKey = profile.openaiApiKey;
              finalGCPKey = profile.gcpApiKey;
              finalGeminiKey = profile.geminiApiKey;
          }
      }

      let result: { buffer: ArrayBuffer, mime: string };
      try {
          if (preferredProvider === 'gemini') {
              result = await synthesizeGemini(cleanText, voiceName, lang, finalGeminiKey);
          } else if (preferredProvider === 'google') {
              result = await synthesizeGoogle(cleanText, voiceName, lang, finalGCPKey);
          } else if (preferredProvider === 'openai') {
              result = await synthesizeOpenAI(cleanText, voiceName, lang, finalOpenAIKey);
          } else {
              throw new Error("UNSUPPORTED_PROVIDER");
          }
      } catch (innerError: any) {
          const isAuthError = innerError.message.includes('400') || innerError.message.includes('403') || innerError.message.includes('API_KEY_INVALID');
          if (isAuthError) {
              return { buffer: null, errorType: 'auth', errorMessage: innerError.message };
          }
          
          const isRateLimit = innerError.message.includes('429') || innerError.message.includes('quota');
          if (preferredProvider === 'gemini' && isRateLimit) {
              dispatchLog(`Gemini TTS Rate Limit (429) hit. Initiating Auto-Failover to Google Cloud Spectrum...`, 'warn');
              return await synthesizeSpeech(text, voiceName, audioContext, 'google', lang, metadata, apiKeyOverride);
          }
          throw innerError;
      }

      const decoded = await safeDecode(result.buffer, audioContext, preferredProvider === 'gemini');
      await cacheAudioBuffer(cacheKey, result.buffer);
      memoryCache.set(cacheKey, decoded);
      return { buffer: decoded, rawBuffer: result.buffer, errorType: 'none', provider: preferredProvider, mime: result.mime };
    } catch (e: any) {
      dispatchLog(`[TTS Fault] ${preferredProvider.toUpperCase()}: ${e.message}`, 'error');
      return { buffer: null, errorType: 'unknown', errorMessage: e.message };
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

async function safeDecode(masterBuffer: ArrayBuffer, ctx: AudioContext, isRawPcm: boolean): Promise<AudioBuffer> {
    if (isRawPcm) return await decodeRawPcm(new Uint8Array(masterBuffer.slice(0)), ctx, 24000, 1);
    return await ctx.decodeAudioData(masterBuffer.slice(0));
}

export async function runNeuralAudit(
  provider: TtsProvider,
  text: string,
  ctx: AudioContext,
  lang: 'en' | 'zh',
  apiKeyOverride?: string
): Promise<void> {
  if (provider === 'system') return await speakSystem(text, lang);
  const result = await synthesizeSpeech(text, 'Zephyr', ctx, provider, lang, undefined, apiKeyOverride);
  if (result.errorType === 'auth') {
      dispatchLog(`Audit Warning: Neural Key Handshake failed. Falling back to local spectrum.`, 'warn');
      return await speakSystem(text, lang);
  }
  if (result.buffer) {
    await new Promise<void>((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = result.buffer!;
      connectOutput(source, ctx);
      source.onended = () => resolve();
      source.start(0);
    });
  }
}
