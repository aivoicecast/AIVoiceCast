
import { GoogleGenAI, Modality } from '@google/genai';
import { base64ToBytes, decodeRawPcm, getGlobalAudioContext, hashString, syncPrimeSpeech, connectOutput, SPEECH_REGISTRY, getSystemVoicesAsync } from '../utils/audioUtils';
import { getCachedAudioBuffer, cacheAudioBuffer } from '../utils/db';
import { auth } from './firebaseConfig';
import { deductCoins, AI_COSTS, saveAudioToLedger, getCloudAudioUrl } from './firestoreService';
import { OPENAI_API_KEY } from './private_keys';

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

function getValidVoiceName(voiceName: string, provider: TtsProvider, lang: 'en' | 'zh' = 'en'): string {
    const name = (voiceName || '').toLowerCase();
    const isInterview = name.includes('0648937375') || name.includes('software interview');
    const isLinux = name.includes('0375218270') || name.includes('linux kernel');
    const isDefaultGem = name.includes('gem') || name.includes('default');

    if (provider === 'google') {
        if (lang === 'zh') return 'cmn-CN-Wavenet-A'; 
        if (isInterview) return 'en-US-Wavenet-B';
        if (isLinux) return 'en-US-Wavenet-J';
        return 'en-US-Wavenet-D';
    } else if (provider === 'openai') {
        const validOpenAI = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
        const matched = validOpenAI.find(v => name.includes(v));
        return matched || 'nova';
    } else {
        if (lang === 'zh') return 'Kore'; 
        if (isInterview) return 'Fenrir';
        if (isLinux) return 'Puck';
        if (isDefaultGem) return 'Zephyr';
        return 'Puck';
    }
}

async function synthesizeGemini(text: string, voice: string, lang: 'en' | 'zh' = 'en'): Promise<{buffer: ArrayBuffer, mime: string}> {
    const targetVoice = getValidVoiceName(voice, 'gemini', lang);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let attempts = 0;
    const maxAttempts = 2;

    let cleanText = text.replace(/[*_#`\[\]()<>|]/g, ' ').replace(/\s+/g, ' ').trim();

    while (attempts < maxAttempts) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{ parts: [{ text: cleanText }] }],
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
            if (!candidate?.content?.parts) throw new Error("API_NO_CONTENT");

            for (const part of candidate.content.parts) {
                if (part.inlineData?.data) {
                    return { 
                        buffer: base64ToBytes(part.inlineData.data).buffer, 
                        mime: 'audio/pcm;rate=24000' 
                    };
                }
            }
            throw new Error(`MISSING_AUDIO_PAYLOAD`);
        } catch (e: any) {
            attempts++;
            if (attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 1000));
            } else {
                throw new Error(`GEMINI_FAULT|${e.message}`);
            }
        }
    }
    throw new Error("RETRY_EXHAUSTED");
}

/**
 * SYSTEM TTS - MacBook / Safari / Chrome Optimized.
 * This version uses a more direct approach to speech synthesis to minimize async lag.
 */
export async function speakSystem(text: string, lang: 'en' | 'zh' = 'en'): Promise<void> {
    const synth = window.speechSynthesis;
    if (!synth) return;

    // Force clear and wake up
    synth.cancel();
    synth.resume();

    const cleanText = text.replace(/[*_#`\[\]()<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanText) return;

    // Small chunks for MacBook stability
    const chunks = cleanText.match(/.{1,200}(\s|$)/g) || [cleanText];
    
    const voices = synth.getVoices();
    const bestVoice = lang === 'zh' 
        ? (voices.find(v => v.lang.includes('zh') && v.name.includes('Siri')) || voices.find(v => v.lang.includes('zh')))
        : (voices.find(v => v.lang.includes('en') && v.name.includes('Siri')) || voices.find(v => v.lang.includes('en') && v.name.includes('Samantha')) || voices.find(v => v.lang.includes('en')));

    for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;

        await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(trimmed);
            if (bestVoice) utterance.voice = bestVoice;
            else utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-US';

            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            SPEECH_REGISTRY.add(utterance);

            utterance.onend = () => {
                SPEECH_REGISTRY.delete(utterance);
                resolve();
            };

            utterance.onerror = (e) => {
                console.warn("[System TTS] Error:", e);
                SPEECH_REGISTRY.delete(utterance);
                resolve();
            };

            // Vital for long chunks on Mac: prevent engine timeout
            const aliveTimer = setInterval(() => {
                if (synth.speaking) {
                    synth.pause();
                    synth.resume();
                } else {
                    clearInterval(aliveTimer);
                }
            }, 10000);

            synth.speak(utterance);
        });
    }
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
  if (preferredProvider === 'system') {
      return { buffer: null, errorType: 'none', provider: 'system' };
  }

  const cleanText = text.replace(/`/g, '').trim();
  const textFingerprint = await hashString(`${voiceName}:${lang}:${cleanText}`);
  const globalNodeId = metadata?.nodeId ? `${metadata.nodeId}_${textFingerprint.substring(0, 12)}` : textFingerprint;
  const cacheKey = `${preferredProvider}:${voiceName}:${lang}:${textFingerprint}`;
  
  if (memoryCache.has(cacheKey)) {
      return { buffer: memoryCache.get(cacheKey)!, errorType: 'none', provider: preferredProvider };
  }
  
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const requestPromise = (async (): Promise<TtsResult> => {
    try {
      const localCached = await getCachedAudioBuffer(cacheKey);
      if (localCached) {
        const audioBuffer = await safeDecode(localCached, audioContext, preferredProvider === 'gemini');
        memoryCache.set(cacheKey, audioBuffer);
        return { buffer: audioBuffer, rawBuffer: localCached, errorType: 'none', provider: preferredProvider };
      }

      const ledgerUrl = await getCloudAudioUrl(globalNodeId);
      if (ledgerUrl) {
          const response = await fetch(ledgerUrl);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await safeDecode(arrayBuffer, audioContext, preferredProvider === 'gemini');
          await cacheAudioBuffer(cacheKey, arrayBuffer.slice(0));
          memoryCache.set(cacheKey, audioBuffer);
          return { buffer: audioBuffer, rawBuffer: arrayBuffer, errorType: 'none', provider: preferredProvider };
      }

      let result: { buffer: ArrayBuffer, mime: string };
      if (preferredProvider === 'gemini') {
          result = await synthesizeGemini(cleanText, voiceName, lang);
      } else if (preferredProvider === 'openai') {
          const buffer = await synthesizeOpenAI(cleanText, voiceName);
          result = { buffer, mime: 'audio/mpeg' };
      } else {
          throw new Error("UNSUPPORTED_PROVIDER");
      }

      const decoded = await safeDecode(result.buffer, audioContext, preferredProvider === 'gemini');
      await cacheAudioBuffer(cacheKey, result.buffer);
      memoryCache.set(cacheKey, decoded);
      if (metadata?.nodeId) {
          await saveAudioToLedger(globalNodeId, new Uint8Array(result.buffer), result.mime);
      }

      return { 
          buffer: decoded, 
          rawBuffer: result.buffer, 
          errorType: 'none', 
          provider: preferredProvider,
          mime: result.mime 
      };
    } catch (e: any) {
      console.error(`[TTS] Synthesis Fault:`, e);
      return { buffer: null, errorType: 'unknown', errorMessage: e.message };
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

async function synthesizeOpenAI(text: string, voice: string): Promise<ArrayBuffer> {
    const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY || '';
    if (!apiKey) throw new Error("AUTH_ERROR|OpenAI Key Missing.");
    
    const targetVoice = getValidVoiceName(voice, 'openai');
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${apiKey}`, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
            model: 'tts-1', 
            input: text, 
            voice: targetVoice,
            response_format: 'mp3'
        })
    });
    
    if (!response.ok) throw new Error(`OPENAI_ERROR|${response.status}`);
    return await response.arrayBuffer();
}

async function safeDecode(masterBuffer: ArrayBuffer, ctx: AudioContext, isRawPcm: boolean): Promise<AudioBuffer> {
    if (isRawPcm) return await decodeRawPcm(new Uint8Array(masterBuffer.slice(0)), ctx, 24000, 1);
    try {
        return await ctx.decodeAudioData(masterBuffer.slice(0));
    } catch (e) {
        return await decodeRawPcm(new Uint8Array(masterBuffer.slice(0)), ctx, 24000, 1);
    }
}

/**
 * Audits the neural audio spectrum by synthesizing a test string and playing it immediately.
 */
export async function runNeuralAudit(
  provider: TtsProvider,
  text: string,
  ctx: AudioContext,
  lang: 'en' | 'zh',
  apiKey?: string
): Promise<void> {
  if (provider === 'system') {
    return await speakSystem(text, lang);
  }
  
  const result = await synthesizeSpeech(text, 'Zephyr', ctx, provider, lang, undefined, apiKey);
  if (result.buffer) {
    return new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = result.buffer;
      connectOutput(source, ctx);
      source.onended = () => resolve();
      source.start(0);
    });
  }
}
