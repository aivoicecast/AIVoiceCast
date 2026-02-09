
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
// Fix: safeJsonStringify is not exported from audioUtils, it resides in idUtils
import { base64ToBytes, decodeRawPcm, createPcmBlob, warmUpAudioContext, registerAudioOwner, getGlobalAudioContext, connectOutput } from '../utils/audioUtils';
// Fix: added correct import for safeJsonStringify
import { safeJsonStringify } from '../utils/idUtils';

export interface LiveConnectionCallbacks {
  onOpen: () => void;
  onClose: (reason: string, code?: number) => void;
  onError: (error: string, code?: string) => void;
  onVolumeUpdate: (volume: number) => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onToolCall?: (toolCall: any) => void;
  onToolResponse?: (response: any) => void;
  onTurnComplete?: () => void;
  onAudioData?: (data: Uint8Array) => boolean; 
}

function getValidLiveVoice(voiceName: string): string {
  const name = voiceName || '';
  if (name.includes('0648937375')) return 'Fenrir';
  if (name.includes('0375218270')) return 'Puck';
  
  const validGemini = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
  for (const v of validGemini) {
      if (name.toLowerCase().includes(v.toLowerCase())) return v;
  }
  return 'Zephyr';
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

  private dispatchLog(text: string, type: 'info' | 'success' | 'warn' | 'error' | 'trace' | 'input' | 'output' = 'info', meta?: any) {
      // PRE-FLIGHT SANITIZATION:
      // Ensure metadata dispatched to the global bus is never circular.
      // This prevents environment-level JSON conversion errors in AI Studio.
      let safeMeta = null;
      if (meta) {
          try {
              safeMeta = JSON.parse(safeJsonStringify(meta));
          } catch(e) {
              safeMeta = { error: "Serialization Fault", category: meta?.category };
          }
      }

      window.dispatchEvent(new CustomEvent('neural-log', { 
          detail: { text: `[LiveAPI] ${text}`, type, meta: safeMeta } 
      }));
  }

  public async initializeAudio() {
    if (!this.inputAudioContext) {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    this.outputAudioContext = getGlobalAudioContext(24000);
    
    await Promise.all([
      warmUpAudioContext(this.inputAudioContext),
      warmUpAudioContext(this.outputAudioContext)
    ]);
    
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  async connect(voiceName: string, systemInstruction: string, callbacks: LiveConnectionCallbacks, tools?: any, externalStream?: MediaStream) {
    try {
      this.isActive = true;
      this.dispatchLog(`Initiating Handshake for Session ID: ${this.id}`, 'info');
      registerAudioOwner(`Live_${this.id}`, () => this.disconnect());
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (!this.inputAudioContext || this.inputAudioContext.state !== 'running') {
        await this.initializeAudio();
      }

      if (externalStream) {
          this.stream = externalStream;
      } else if (!this.stream) {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const validVoice = getValidLiveVoice(voiceName);
      const isScribeMode = systemInstruction.toLowerCase().includes("scribe") || systemInstruction.toLowerCase().includes("silent");
      const modelId = 'gemini-2.5-flash-native-audio-preview-12-2025';

      const config: any = {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: validVoice }
              }
          },
          systemInstruction: systemInstruction.trim(),
          inputAudioTranscription: {},
          outputAudioTranscription: {}
      };

      if (tools) {
          config.tools = tools; 
      }

      this.sessionPromise = ai.live.connect({
        model: modelId,
        config,
        callbacks: {
          onopen: () => {
            if (!this.isActive) return;
            this.dispatchLog(`WebSocket Tunnel Open: ${modelId}`, 'success', { category: 'LIVE_API' });
            this.startAudioInput(callbacks.onVolumeUpdate);
            callbacks.onOpen();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!this.isActive) return;
            
            if (message.toolCall) {
                this.dispatchLog(`Tool Call Inbound: ${message.toolCall.functionCalls.map(f => f.name).join(', ')}`, 'input', { category: 'LIVE_API', meta: message.toolCall });
                callbacks.onToolCall?.(message.toolCall);
            }
            
            const inTrans = message.serverContent?.inputTranscription;
            if (inTrans?.text) {
                callbacks.onTranscript(inTrans.text, true);
            }
            
            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
                const base64Audio = part.inlineData?.data;
                if (base64Audio && this.outputAudioContext && !isScribeMode) {
                    try {
                        const bytes = base64ToBytes(base64Audio);
                        const shouldPlay = callbacks.onAudioData ? callbacks.onAudioData(bytes) : true;
                        if (!shouldPlay) continue;

                        this.isPlayingResponse = true;
                        if (this.speakingTimer) clearTimeout(this.speakingTimer);
                        
                        if (this.outputAudioContext.state !== 'running') {
                            await this.outputAudioContext.resume();
                        }

                        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
                        const audioBuffer = await decodeRawPcm(bytes, this.outputAudioContext, 24000, 1);
                        const source = this.outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        
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
                    } catch (e: any) {
                        this.dispatchLog(`Audio Stream Fault: ${e.message}`, 'error');
                    }
                }
                
                if (part.text && !isScribeMode) {
                    callbacks.onTranscript(part.text, false);
                }
            }

            if (message.serverContent?.interrupted) {
                this.dispatchLog(`Interruption Detected. Clearing Audio Pipeline.`, 'warn', { category: 'LIVE_API' });
                this.stopAllSources();
                this.nextStartTime = 0;
                this.isPlayingResponse = false;
            }

            if (message.serverContent?.turnComplete) {
                callbacks.onTurnComplete?.();
            }
          },
          onclose: (e: any) => {
            if (!this.isActive) return;
            const wasIntentional = !this.session;
            this.dispatchLog(`WebSocket Tunnel Closed. Code: ${e?.code || '---'} Reason: ${e?.reason || 'Protocol Termination'}`, wasIntentional ? 'info' : 'error', { category: 'LIVE_API' });
            this.cleanup();
            if (!wasIntentional) {
               callbacks.onClose(e?.reason || "WebSocket closed unexpectedly", e?.code);
            }
          },
          onerror: (e: any) => {
            if (!this.isActive) return;
            this.dispatchLog(`Critical Transport Error: ${e?.message || String(e)}`, 'error', { category: 'LIVE_API' });
            this.cleanup();
            const errMsg = e?.message || String(e);
            callbacks.onError(errMsg);
          }
        }
      });

      this.session = await this.sessionPromise;
    } catch (error: any) {
      this.isActive = false;
      this.dispatchLog(`Handshake Terminal Fault: ${error?.message || String(error)}`, 'error', { category: 'LIVE_API' });
      callbacks.onError(error?.message || String(error));
      this.cleanup();
      throw error;
    }
  }

  public sendToolResponse(functionResponses: any) {
      // CRITICAL FIX: The Live API expects an ARRAY of responses in the functionResponses key.
      const responsesArray = Array.isArray(functionResponses) ? functionResponses : [functionResponses];
      this.dispatchLog(`Tool Response Dispatched: ${responsesArray.map(r => r.name).join(', ')}`, 'output', { category: 'LIVE_API', meta: responsesArray });
      this.sessionPromise?.then((session) => {
          session.sendToolResponse({ functionResponses: responsesArray });
      });
  }

  public sendText(text: string) {
    this.sessionPromise?.then((session) => {
      session.sendRealtimeInput({
        parts: [{ text }]
      });
    });
  }

  public sendMedia(data: string, mimeType: string) {
    this.sessionPromise?.then((session) => {
      session.sendRealtimeInput({
        media: { data, mimeType }
      });
    });
  }

  private startAudioInput(onVolume: (v: number) => void) {
    if (!this.inputAudioContext || !this.stream || !this.sessionPromise) return;
    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      let sum = 0;
      for(let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      onVolume(Math.sqrt(sum / inputData.length) * 5);
      
      const pcmBlob = createPcmBlob(inputData);
      
      this.sessionPromise?.then((session) => { 
          session.sendRealtimeInput({ media: pcmBlob }); 
      });
    };
    
    this.source.connect(this.processor);
    const silentGain = this.inputAudioContext.createGain();
    silentGain.gain.value = 0;
    this.processor.connect(silentGain);
    silentGain.connect(this.inputAudioContext.destination);
  }

  private stopAllSources() {
    for (const source of this.sources) { try { source.stop(); source.disconnect(); } catch(e) {} }
    this.sources.clear();
  }

  async disconnect() {
    this.isActive = false;
    if (this.session) { try { (this.session as any).close?.(); } catch(e) {} }
    this.session = null;
    this.cleanup();
  }

  private cleanup() {
    this.stopAllSources();
    this.isPlayingResponse = false;
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    if (this.processor) { try { this.processor.disconnect(); this.processor.onaudioprocess = null; } catch(e) {} }
    if (this.source) try { this.source.disconnect(); } catch(e) {}
    this.stream?.getTracks().forEach(track => track.stop());
    this.sessionPromise = null;
    this.stream = null;
    this.processor = null;
    this.source = null;
    this.nextStartTime = 0;
  }
}
