
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

  private getSanitizedKey(key?: string): string {
      const raw = (key || '').trim();
      if (!raw || raw === 'YOUR_GEMINI_API_KEY_HERE' || raw === 'YOUR_BASE_API_KEY') {
          return '';
      }
      return raw;
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
      
      const key = this.getSanitizedKey(process.env.API_KEY);
      if (!key) {
          throw new Error("Gemini API Key missing or invalid in .env file.");
      }

      const ai = new GoogleGenAI({ apiKey: key });
      
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
            const reason = e?.reason || "";
            const code = e?.code;
            
            // MANDATORY API KEY RECOVERY:
            // "Requested entity was not found" is a key/quota error.
            // Reset the key and prompt the user to select one again.
            if (reason.includes("Requested entity was not found")) {
                this.dispatchLog(`Identity Resolution Failure: ${reason}. Resetting Auth Spectrum.`, 'error');
                (window as any).aistudio?.openSelectKey();
            }

            const wasIntentional = !this.session;
            this.dispatchLog(`WebSocket Tunnel Closed. Code: ${code || '---'} Reason: ${reason || 'Protocol Termination'}`, wasIntentional ? 'info' : 'error', { category: 'LIVE_API' });
            this.cleanup();
            if (!wasIntentional) {
               callbacks.onClose(reason || "WebSocket closed unexpectedly", code);
            }
          },
          onerror: (e: any) => {
            if (!this.isActive) return;
            const errMsg = e?.message || String(e);
            
            if (errMsg.includes("Requested entity was not found")) {
                this.dispatchLog(`Identity Resolution Failure: ${errMsg}. Resetting Auth Spectrum.`, 'error');
                (window as any).aistudio?.openSelectKey();
            }

            this.dispatchLog(`Critical Transport Error: ${errMsg}`, 'error', { category: 'LIVE_API' });
            this.cleanup();
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

  public startAudioInput(onVolumeUpdate: (volume: number) => void) {
    if (!this.inputAudioContext || !this.stream) return;

    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isActive) return;
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Volume calculation for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      onVolumeUpdate(Math.sqrt(sum / inputData.length));

      const pcmBlob = createPcmBlob(inputData);
      // Solely rely on sessionPromise resolves
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private stopAllSources() {
    this.sources.forEach(s => {
      try { s.stop(); s.disconnect(); } catch (e) {}
    });
    this.sources.clear();
  }

  private cleanup() {
    this.stopAllSources();
    this.isActive = false;
    this.session = null;
    this.sessionPromise = null;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
        this.inputAudioContext.close();
        this.inputAudioContext = null;
    }
  }

  public async disconnect() {
    this.dispatchLog("Disconnecting session...", 'info');
    if (this.session) {
        try { await this.session.close(); } catch(e) {}
    }
    this.cleanup();
  }

  public sendText(text: string) {
      this.sessionPromise?.then(session => {
          session.sendRealtimeInput({ text });
      });
  }

  public sendMedia(data: string, mimeType: string) {
      this.sessionPromise?.then(session => {
          session.sendRealtimeInput({ media: { data, mimeType } });
      });
  }

  public sendToolResponse(functionResponses: any) {
      const responsesArray = Array.isArray(functionResponses) ? functionResponses : [functionResponses];
      this.dispatchLog(`Tool Response Dispatched: ${responsesArray.map(r => r.name || r.id).join(', ')}`, 'output');
      this.sessionPromise?.then(session => {
          session.sendToolResponse({ functionResponses: responsesArray[0] });
      });
  }
}
