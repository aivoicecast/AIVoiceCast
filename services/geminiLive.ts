
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToBytes, decodeRawPcm, createPcmBlob, getGlobalAudioContext, warmUpAudioContext, coolDownAudioContext, registerAudioOwner } from '../utils/audioUtils';

export interface LiveConnectionCallbacks {
  onOpen: () => void;
  onClose: () => void;
  onError: (error: Error) => void;
  onVolumeUpdate: (volume: number) => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onToolCall?: (toolCall: any) => void;
}

export class GeminiLiveService {
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private sessionPromise: Promise<any> | null = null;
  
  private outputDestination: MediaStreamAudioDestinationNode | null = null;
  private isPlayingResponse: boolean = false;
  private speakingTimer: any = null;

  constructor() {
      if (typeof window !== 'undefined') {
          const resumeAudio = () => {
              this.outputAudioContext?.resume().catch(() => {});
              this.inputAudioContext?.resume().catch(() => {});
          };
          window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resumeAudio(); });
          window.addEventListener('pageshow', resumeAudio);
      }
  }

  public initializeAudio() {
    this.inputAudioContext = getGlobalAudioContext(16000);
    this.outputAudioContext = getGlobalAudioContext(24000);
    
    if (this.outputAudioContext) {
        this.outputDestination = this.outputAudioContext.createMediaStreamDestination();
    }

    warmUpAudioContext(this.inputAudioContext).catch(() => {});
    warmUpAudioContext(this.outputAudioContext).catch(() => {});
  }

  public getOutputMediaStream(): MediaStream | null {
      return this.outputDestination ? this.outputDestination.stream : null;
  }

  public sendVideo(base64Data: string, mimeType: string = 'image/jpeg') {
      this.sessionPromise?.then((session) => {
          if (session) {
              try { session.sendRealtimeInput({ media: { mimeType, data: base64Data } }); } catch(e) {}
          }
      });
  }

  async connect(
    voiceName: string, 
    systemInstruction: string, 
    callbacks: LiveConnectionCallbacks,
    tools?: any[]
  ) {
    try {
      // 1. REGISTER OWNER TO KILL OTHER AUDIO
      // Fixed: Added source name "GeminiLive" as the first argument to registerAudioOwner
      registerAudioOwner("GeminiLive", () => this.disconnect());

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!this.inputAudioContext) this.initializeAudio();

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const validVoice = voiceName || 'Puck';

      const connectionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: validVoice } } },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          tools: tools,
        },
        callbacks: {
          onopen: () => {
            this.startAudioInput(callbacks.onVolumeUpdate);
            this.outputAudioContext?.resume();
            callbacks.onOpen();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) callbacks.onToolCall?.(message.toolCall);

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && this.outputAudioContext) {
              try {
                this.isPlayingResponse = true;
                if (this.speakingTimer) clearTimeout(this.speakingTimer);
                
                const bytes = base64ToBytes(base64Audio);
                let sum = 0; for (let i=0; i<bytes.length; i++) sum += Math.abs(bytes[i] - 128);
                callbacks.onVolumeUpdate((sum / bytes.length) * 0.5);

                this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
                const audioBuffer = await decodeRawPcm(bytes, this.outputAudioContext, 24000, 1);
                const source = this.outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.outputAudioContext.destination);
                if (this.outputDestination) source.connect(this.outputDestination);
                source.addEventListener('ended', () => {
                  this.sources.delete(source);
                  if (this.sources.size === 0) this.speakingTimer = setTimeout(() => { this.isPlayingResponse = false; }, 500);
                });
                source.start(this.nextStartTime);
                this.sources.add(source);
                this.nextStartTime += audioBuffer.duration;
              } catch (e) {}
            }

            const outputText = message.serverContent?.outputTranscription?.text;
            if (outputText) callbacks.onTranscript(outputText, false);
            const inputText = message.serverContent?.inputTranscription?.text;
            if (inputText) callbacks.onTranscript(inputText, true);
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) { this.stopAllSources(); this.nextStartTime = 0; this.isPlayingResponse = false; }
          },
          onclose: () => { this.cleanup(); callbacks.onClose(); },
          onerror: (e: any) => { this.cleanup(); callbacks.onError(new Error(e.message || "Connection failed")); }
        }
      });

      this.sessionPromise = Promise.race([connectionPromise, new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 15000))]);
      this.session = await this.sessionPromise;
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error("Failed to connect"));
      this.cleanup();
    }
  }

  public sendText(text: string) {
    this.sessionPromise?.then((session) => {
        if (session) {
            try { session.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } }); } catch (e) {}
        }
    });
  }

  public sendToolResponse(functionResponses: any) {
      this.sessionPromise?.then((session) => {
          if (session) {
              try { session.sendToolResponse({ functionResponses }); } catch(e) {}
          }
      });
  }

  private startAudioInput(onVolume: (v: number) => void) {
    if (!this.inputAudioContext || !this.stream || !this.sessionPromise) return;
    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.inputAudioContext || !this.processor) return;
      const inputData = e.inputBuffer.getChannelData(0);
      if (this.isPlayingResponse) { onVolume(0); return; }
      let sum = 0; for(let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      onVolume(Math.sqrt(sum / inputData.length) * 5);
      const pcmBlob = createPcmBlob(inputData);
      this.sessionPromise?.then(session => { if (session) try { session.sendRealtimeInput({ media: pcmBlob }); } catch(err) {} });
    };
    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private stopAllSources() {
    for (const source of this.sources) { try { source.stop(); source.disconnect(); } catch (e) {} }
    this.sources.clear();
  }

  async disconnect() {
    if (this.session) try { (this.session as any).close?.(); } catch(e) {}
    this.cleanup();
  }

  private cleanup() {
    this.stopAllSources();
    this.isPlayingResponse = false;
    coolDownAudioContext();
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    if (this.processor) { try { this.processor.disconnect(); this.processor.onaudioprocess = null; } catch(e) {} }
    if (this.source) try { this.source.disconnect(); } catch(e) {}
    this.stream?.getTracks().forEach(track => track.stop());
    this.session = null;
    this.sessionPromise = null;
    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.stream = null;
    this.processor = null;
    this.source = null;
    this.outputDestination = null;
    this.nextStartTime = 0;
  }
}
