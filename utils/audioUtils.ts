import { Blob as GeminiBlob } from '@google/genai';

let mainAudioContext: AudioContext | null = null;
let mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
let silentLoopElement: HTMLAudioElement | null = null;

/**
 * GLOBAL AUDIO AUDIT & ATOMIC GENERATION
 */
export interface AudioEvent {
    timestamp: number;
    source: string;
    action: 'REGISTER' | 'STOP' | 'PLAY_BUFFER' | 'PLAY_SYSTEM' | 'ERROR' | 'ABORT_STALE' | 'GEN_INC';
    details?: string;
}

let audioAuditLogs: AudioEvent[] = [];
let currentOwnerToken: string | null = null;
let currentStopFn: (() => void) | null = null;
let globalAudioGeneration: number = 0;

export function getAudioAuditLogs() {
    return audioAuditLogs;
}

export function getGlobalAudioGeneration() {
    return globalAudioGeneration;
}

export function logAudioEvent(source: string, action: AudioEvent['action'], details?: string) {
    const event = { timestamp: Date.now(), source, action, details };
    audioAuditLogs = [event, ...audioAuditLogs].slice(0, 50);
    console.log(`[AUDIO_DEBUG] ${source}: ${action} ${details || ''}`);
    window.dispatchEvent(new CustomEvent('audio-audit-updated', { detail: event }));
}

export function getCurrentAudioOwner() {
    return currentOwnerToken;
}

export function isAnyAudioPlaying(): boolean {
    return !!currentOwnerToken;
}

/**
 * Hard kill for all platform audio.
 * Resets the global lock and increments the Atomic Generation.
 */
export function stopAllPlatformAudio(sourceCaller: string = "Global") {
    globalAudioGeneration++;
    
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    if (currentStopFn) {
        const fn = currentStopFn;
        currentStopFn = null; 
        try { 
            fn(); 
        } catch (e) {
            console.warn("Error during audio owner cleanup", e);
        }
    }
    
    currentOwnerToken = null;
    logAudioEvent(sourceCaller, 'STOP', `Gen INC to ${globalAudioGeneration}. Global audio cleared.`);
}

/**
 * Register a unique ownership token.
 * Kills everyone else and returns the current valid generation.
 */
export function registerAudioOwner(uniqueToken: string, stopFn: () => void): number {
    stopAllPlatformAudio(`Reg:${uniqueToken}`);
    currentOwnerToken = uniqueToken;
    currentStopFn = stopFn;
    logAudioEvent(uniqueToken, 'REGISTER', `Lock Acquired @ Gen ${globalAudioGeneration}`);
    return globalAudioGeneration;
}

export function isAudioOwner(token: string): boolean {
    return currentOwnerToken === token;
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

/**
 * Returns the shared MediaStream destination for recording purposes.
 * This node receives mixed audio from all sources.
 */
export function getGlobalMediaStreamDest(sampleRate?: number): MediaStreamAudioDestinationNode {
    getGlobalAudioContext(sampleRate);
    return mediaStreamDest!;
}

/**
 * Connects an audio source to both the user's speakers and the recording bus.
 */
export function connectOutput(source: AudioNode, ctx: AudioContext) {
    // 1. Connect to actual speakers
    source.connect(ctx.destination);
    
    // 2. Connect to recording bus if available
    if (mediaStreamDest) {
        source.connect(mediaStreamDest);
    }

    // 3. Auto-resume context if it was suspended (prevents silence)
    if (ctx.state === 'suspended') {
        ctx.resume().catch(console.warn);
    }
}

export function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes raw PCM data into an AudioBuffer.
 * Handles automatic detection and skipping of WAV headers to prevent start-of-verse noise.
 */
export async function decodeRawPcm(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  // 1. Header Detection: Check for 'RIFF' (82 73 70 70)
  let offset = 0;
  if (data.length > 44 && data[0] === 82 && data[1] === 73 && data[2] === 70 && data[3] === 70) {
      // It's a WAV container. Skip the standard 44-byte header to reach raw samples.
      offset = 44;
  }

  // Use the view offset/length to ensure we don't read garbage if the buffer is shared
  const dataInt16 = new Int16Array(
      data.buffer, 
      data.byteOffset + offset, 
      Math.floor((data.byteLength - offset) / 2)
  );
  
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  // 10ms micro-fade to prevent start-up clicks (assuming 24kHz)
  const fadeLength = Math.min(frameCount, Math.floor(sampleRate * 0.01)); 

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      let sample = dataInt16[i * numChannels + channel] / 32768.0;
      
      // Apply micro fade-in
      if (i < fadeLength) {
          sample *= (i / fadeLength);
      }
      
      channelData[i] = sample;
    }
  }
  return buffer;
}

export async function warmUpAudioContext(ctx: AudioContext) {
    if (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted') {
        await ctx.resume();
    }
    
    if (!silentLoopElement) {
        silentLoopElement = new Audio();
        silentLoopElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA';
        silentLoopElement.loop = true;
        silentLoopElement.setAttribute('playsinline', 'true');
    }
    
    try {
        await silentLoopElement.play();
    } catch(e) {
        console.warn("Background Audio failed to prime.", e);
    }
}

export function coolDownAudioContext() {
    if (silentLoopElement) {
        try { silentLoopElement.pause(); } catch(e) {}
    }
}

export function createPcmBlob(data: Float32Array): GeminiBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: bytesToBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export async function hashString(str: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function pcmToWavBlobUrl(pcmData: Uint8Array, sampleRate: number = 24000): string {
    const blob = pcmToWavBlob(pcmData, sampleRate);
    return URL.createObjectURL(blob);
}

export function pcmToWavBlob(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint32(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const pcmDest = new Uint8Array(buffer, 44);
    pcmDest.set(pcmData);

    return new Blob([buffer], { type: 'audio/wav' });
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const bufferLength = buffer.length;
    const dataSize = bufferLength * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;
    
    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    const offset = 44;
    for (let i = 0; i < bufferLength; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = buffer.getChannelData(channel)[i];
            const clamped = Math.max(-1, Math.min(1, sample));
            const intValue = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
            view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), intValue, true);
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function concatAudioBuffers(buffers: AudioBuffer[], ctx: AudioContext): AudioBuffer | null {
    if (buffers.length === 0) return null;
    if (buffers.length === 1) return buffers[0];
    
    const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
    const result = ctx.createBuffer(
        buffers[0].numberOfChannels,
        totalLength,
        buffers[0].sampleRate
    );
    
    for (let channel = 0; channel < buffers[0].numberOfChannels; channel++) {
        let offset = 0;
        for (const buffer of buffers) {
            result.copyToChannel(buffer.getChannelData(channel), channel, offset);
            offset += buffer.length;
        }
    }
    
    return result;
}