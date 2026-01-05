
import { GoogleGenAI, LiveServerMessage } from '@google/genai';
import { base64ToBytes, decodeRawPcm, createPcmBlob, warmUpAudioContext, coolDownAudioContext, registerAudioOwner, getGlobalAudioContext, connectOutput } from '../utils/audioUtils';

export interface LiveConnectionCallbacks {
  onOpen: () => void;
  onClose: (reason: string, code?: number) => void;
  onError: (error: string) => void;
  onVolumeUpdate: (volume: number) => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onToolCall?: (toolCall: any) => void;
}

function getValidLiveVoice(voiceName: string): string {
  const name = voiceName || '';
  if (name.includes('0648937375') || name === 'Software Interview Voice') return 'Fenrir';
  if (name.includes('0375218270') || name === 'Linux Kernel Voice') return 'Puck';
  if (name.toLowerCase().includes('gem') || name === 'Default Gem') return 'Zephyr';
  const validGemini = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
  return validGemini.includes(voiceName) ? voiceName : 'Puck';
}

export class GeminiLiveService {
  public id: string = Math.random().toString(36).substring(7);
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private sessionPromise: Promise<any> | null = null;
  private isPlayingResponse: boolean = false;
  private speakingTimer: any = null;
  private isActive: boolean = false;

  public async initializeAudio() {
    if (!this.inputAudioContext) {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    this.outputAudioContext = getGlobalAudioContext(24000);
    
    // Explicitly await the resume/play chain to ensure the gesture is locked in
    await Promise.all([
      warmUpAudioContext(this.inputAudioContext),
      warmUpAudioContext(this.outputAudioContext)
    ]);
  }

  async connect(voiceName: string, systemInstruction: string, callbacks: LiveConnectionCallbacks, tools?: any[]) {
    try {
      this.isActive = true;
      registerAudioOwner(`Live_${this.id}`, () => this.disconnect());
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      console.log(`[LiveService] Initializing link for ${voiceName}...`);
      
      if (!this.inputAudioContext || this.inputAudioContext.state !== 'running') {
        await this.initializeAudio();
      }

      if (!this.stream) {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const validVoice = getValidLiveVoice(voiceName);

      const config: any = {
          responseModalities: ['AUDIO'],
          speechConfig: {
              voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: validVoice }
              }
          },
          systemInstruction: systemInstruction.trim(),
          inputAudioTranscription: {},
          outputAudioTranscription: {}
      };

      if (tools && tools.length > 0) {
          config.tools = tools;
      }

      console.log(`[LiveService] Requesting WebSocket connection...`);
      const connectionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config,
        callbacks: {
          onopen: () => {
            if (!this.isActive) return;
            console.log(`[LiveService] WebSocket OPEN. Enabling input.`);
            this.startAudioInput(callbacks.onVolumeUpdate);
            callbacks.onOpen();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!this.isActive) return;
            
            if (message.toolCall) callbacks.onToolCall?.(message.toolCall);
            
            const outTrans = message.serverContent?.outputTranscription;
            if (outTrans?.text) {
                callbacks.onTranscript(outTrans.text, false);
            }
            const inTrans = message.serverContent?.inputTranscription;
            if (inTrans?.text) {
                callbacks.onTranscript(inTrans.text, true);
            }
            
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && this.outputAudioContext) {
              try {
                this.isPlayingResponse = true;
                if (this.speakingTimer) clearTimeout(this.speakingTimer);
                
                // Secondary check for context state
                if (this.outputAudioContext.state === 'suspended') {
                    await this.outputAudioContext.resume();
                }

                const bytes = base64ToBytes(base64Audio);
                this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
                const audioBuffer = await decodeRawPcm(bytes, this.outputAudioContext, 24000, 1);
                const source = this.outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                
                // Connect to both Speakers AND Recorder Bus
                connectOutput(source, this.outputAudioContext);
                
                source.addEventListener('ended', () => {
                  this.sources.delete(source);
                  if (this.sources.size === 0) {
                    this.speakingTimer = setTimeout(() => { this.isPlayingResponse = false; }, 500);
                  }
                });
                source.start(this.nextStartTime);
                this.sources.add(source);
                this.nextStartTime += audioBuffer.duration;
              } catch (e) {
                  console.error("[LiveService] Audio playback error", e);
              }
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
                this.stopAllSources();
                this.nextStartTime = 0;
                this.isPlayingResponse = false;
            }
          },
          onclose: (e: any) => {
            if (!this.isActive) return;
            const code = e?.code || 1000;
            let reason = e?.reason || "Link closed";
            console.warn(`[LiveService] WebSocket CLOSED: ${reason} (${code})`);
            this.cleanup();
            callbacks.onClose(reason, code);
          },
          onerror: (e: any) => {
            if (!this.isActive) return;
            console.error(`[LiveService] WebSocket ERROR`, e);
            this.cleanup();
            callbacks.onError(e?.message || "Handshake Error");
          }
        }
      });

      this.sessionPromise = connectionPromise;
      this.session = await this.sessionPromise;
    } catch (error: any) {
      this.isActive = false;
      console.error(`[LiveService] Connection exception`, error);
      callbacks.onError(error?.message || "Auth Error");
      this.cleanup();
    }
  }

  public sendToolResponse(functionResponses: any) {
      this.sessionPromise?.then((session) => {
          if (session) session.sendToolResponse({ functionResponses });
      });
  }

  private startAudioInput(onVolume: (v: number) => void) {
    if (!this.inputAudioContext || !this.stream || !this.sessionPromise) return;
    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      if (this.isPlayingResponse) { onVolume(0); } else {
          let sum = 0;
          for(let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
          onVolume(Math.sqrt(sum / inputData.length) * 5);
      }
      const pcmBlob = createPcmBlob(inputData);
      this.sessionPromise?.then((session) => { 
          if (session && this.isActive) session.sendRealtimeInput({ media: pcmBlob }); 
      });
    };
    
    this.source.connect(this.processor);
    
    // CRITICAL: We connect the processor to a zero-gain node to keep it active
    // without playing the user's microphone back through their speakers.
    const silentGain = this.inputAudioContext.createGain();
    silentGain.gain.value = 0;
    this.processor.connect(silentGain);
    silentGain.connect(this.inputAudioContext.destination);
  }

  private stopAllSources() {
    for (const source of this.sources) { try { source.stop(); source.disconnect(); } catch (e) {} }
    this.sources.clear();
  }

  async disconnect() {
    this.isActive = false;
    console.log(`[LiveService] Disconnecting...`);
    if (this.session) { try { (this.session as any).close?.(); } catch(e) {} }
    this.cleanup();
  }

  private cleanup() {
    this.stopAllSources();
    this.isPlayingResponse = false;
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    if (this.processor) { try { this.processor.disconnect(); this.processor.onaudioprocess = null; } catch(e) {} }
    if (this.source) try { this.source.disconnect(); } catch(e) {}
    this.stream?.getTracks().forEach(track => track.stop());
    this.session = null;
    this.sessionPromise = null;
    this.stream = null;
    this.processor = null;
    this.source = null;
    this.nextStartTime = 0;
  }
}
