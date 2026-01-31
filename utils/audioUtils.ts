
import { Blob as GeminiBlob } from '@google/genai';

let mainAudioContext: AudioContext | null = null;
let mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
let audioGeneration = 0;

export const SPEECH_REGISTRY: Set<SpeechSynthesisUtterance> = new Set();
let cachedSystemVoices: SpeechSynthesisVoice[] = [];

export function getGlobalAudioGeneration(): number {
    return audioGeneration;
}

export function primeNeuralAudio() {
    syncPrimeSpeech();
}

/**
 * Generates a SHA-256 hash of a string.
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function pcmToWavBlobUrl(pcmData: Uint8Array, sampleRate: number): string {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmData.length, true);
  const blob = new Blob([header, pcmData], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export function getGlobalAudioContext(sampleRate: number = 24000): AudioContext {
  if (!mainAudioContext || mainAudioContext.state === 'closed') {
    mainAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate,
        latencyHint: 'playback' 
    });
    mediaStreamDest = mainAudioContext.createMediaStreamDestination();
  }
  return mainAudioContext;
}

export function getGlobalMediaStreamDest(): MediaStreamAudioDestinationNode {
    getGlobalAudioContext();
    return mediaStreamDest!;
}

export function connectOutput(source: AudioNode, ctx: AudioContext) {
    source.connect(ctx.destination);
    if (mediaStreamDest) source.connect(mediaStreamDest);
    if (ctx.state === 'suspended') ctx.resume().catch(console.warn);
}

/**
 * Proactive Neural Handshake: Forces context out of suspended/interrupted states.
 */
export async function warmUpAudioContext(ctx: AudioContext, attempts = 0): Promise<void> {
    if (!ctx) return;
    // Fix: cast state to string to allow 'interrupted' check (Safari/iOS) and avoid narrowing errors in TS
    const currentState = ctx.state as string;
    if (currentState === 'suspended' || currentState === 'interrupted') {
        try {
            await ctx.resume();
            // Fix: cast state to string again after resume to verify transition without narrowing comparison errors
            if ((ctx.state as string) === 'running') return;
        } catch (e) {
            if (attempts < 3) {
                await new Promise(r => setTimeout(r, 100));
                return warmUpAudioContext(ctx, attempts + 1);
            }
        }
    }
}

/**
 * Forces the browser's speech synthesis engine out of a deadlocked state.
 */
export function syncPrimeSpeech() {
    const ctx = getGlobalAudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(console.warn);
    
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
        const wakeUp = new SpeechSynthesisUtterance("");
        wakeUp.volume = 0;
        wakeUp.rate = 10;
        window.speechSynthesis.speak(wakeUp);
        window.speechSynthesis.resume();
    }
}

export async function getSystemVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
    if (cachedSystemVoices.length > 0) return cachedSystemVoices;
    return new Promise((resolve) => {
        let voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            cachedSystemVoices = voices;
            return resolve(voices);
        }
        const handler = () => {
            voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                window.speechSynthesis.removeEventListener('voiceschanged', handler);
                cachedSystemVoices = voices;
                resolve(voices);
            }
        };
        window.speechSynthesis.addEventListener('voiceschanged', handler);
        setTimeout(() => {
            voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) resolve(voices);
            else resolve([]); 
        }, 800);
    });
}

export function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

export async function decodeRawPcm(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  let offset = 0;
  if (data.length > 44 && data[0] === 82 && data[1] === 73 && data[2] === 70 && data[3] === 70) offset = 44;
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset + offset, Math.floor((data.byteLength - offset) / 2));
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

export function createPcmBlob(data: Float32Array): GeminiBlob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
    return {
        data: bytesToBase64(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

let currentStopFn: (() => void) | null = null;

export function registerAudioOwner(uniqueToken: string, stopFn: () => void): number {
    if (currentStopFn) currentStopFn();
    currentStopFn = stopFn;
    return audioGeneration;
}

export function stopAllPlatformAudio(context?: string) {
    if (currentStopFn) { currentStopFn(); currentStopFn = null; }
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    audioGeneration++;
}
