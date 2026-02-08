
import { GoogleGenAI, Type } from '@google/genai';
import { GeneratedLecture, TranscriptItem, NeuralLensAudit } from '../types';
import { getCloudCachedLecture, saveCloudCachedLecture, deductCoins, AI_COSTS, incrementApiUsage, getUserProfile } from './firestoreService';
import { auth } from './firebaseConfig';
import { generateContentUid } from '../utils/idUtils';
import { logger } from './logger';

const MAX_RETRIES = 3;

/**
 * Lowest-level API Orchestrator with Deep Telemetry.
 */
async function runWithDeepTelemetry(
    operation: () => Promise<any>, 
    context: string, 
    category: string,
    rawInput: string
): Promise<{ response: any, attempts: number, latency: number, inputSize: number }> {
    let attempts = 0;
    const inputSize = new TextEncoder().encode(rawInput).length;
    const startTime = performance.now();
    
    while (attempts < MAX_RETRIES) {
        try {
            attempts++;
            const response = await operation();
            const latency = performance.now() - startTime;
            return { response, attempts, latency, inputSize };
        } catch (e: any) {
            const isFatal = e.message?.includes('403') || e.message?.includes('400') || e.message?.includes('API_KEY_INVALID');
            logger.warn(`Neural Handshake Attempt ${attempts} failed: ${context}`, { category, retryCount: attempts });
            
            if (attempts >= MAX_RETRIES || isFatal) {
                logger.error(`Critical Circuit Breaker triggered for ${context}. Node terminated.`, e, { category, retryCount: attempts });
                throw e;
            }
            await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 1000));
        }
    }
    throw new Error("Handshake timeout: Max retries exceeded.");
}

export async function summarizeLectureForContext(lecture: GeneratedLecture): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const text = lecture.sections.map(s => s.text).join('\n').substring(0, 5000);
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Summarize the technical concepts and key terms covered in this dialogue. Focus on unique takeaways to prevent redundancy in future segments.\n\nCONTENT:\n${text}`,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || '';
    } catch (e) {
        return "Concept coverage: " + lecture.topic;
    }
}

export async function performNeuralLensAudit(lecture: GeneratedLecture, language: 'en' | 'zh' = 'en'): Promise<NeuralLensAudit | null> {
    const category = 'SHADOW_AUDIT';
    const model = 'gemini-3-pro-preview';
    
    if (!lecture.sections || lecture.sections.length === 0) {
        logger.error("Shadow Audit Refused: Empty logic node.", null, { category });
        return null;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const content = lecture.sections.map(s => `${s.speaker}: ${s.text}`).join('\n');
        const systemInstruction = `You are the Shadow Agent. Perform a formal audit of the provided reasoning chain. Return strictly valid JSON.`;

        const { response, attempts, latency, inputSize } = await runWithDeepTelemetry(async () => {
            return await ai.models.generateContent({
                model,
                contents: `AUDIT CONTENT:\n\n${content}`,
                config: { 
                    systemInstruction, 
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            coherenceScore: { type: Type.NUMBER },
                            driftRisk: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                            robustness: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                            graph: {
                                type: Type.OBJECT,
                                properties: {
                                    nodes: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                id: { type: Type.STRING },
                                                label: { type: Type.STRING },
                                                type: { type: Type.STRING, enum: ['concept', 'metric', 'component'] }
                                            },
                                            required: ["id", "label", "type"]
                                        }
                                    },
                                    links: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                source: { type: Type.STRING },
                                                target: { type: Type.STRING },
                                                label: { type: Type.STRING }
                                            },
                                            required: ["source", "target", "label"]
                                        }
                                    }
                                },
                                required: ["nodes", "links"]
                            },
                            probes: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        question: { type: Type.STRING },
                                        answer: { type: Type.STRING },
                                        status: { type: Type.STRING, enum: ['passed', 'failed', 'warning'] }
                                    },
                                    required: ["question", "answer", "status"]
                                }
                            }
                        },
                        required: ["coherenceScore", "driftRisk", "robustness", "graph", "probes"]
                    }
                }
            });
        }, "Audit Node Refraction", category, content);

        if (!response.text) throw new Error("Null reasoning shard.");
        
        const usage = response.usageMetadata;
        const audit = JSON.parse(response.text.replace(/^```json\s*|```\s*$/g, '').trim());
        
        logger.audit(`Shadow Audit Verified: ${lecture.topic}`, { 
            category, latency, model, retryCount: attempts,
            inputTokens: usage?.promptTokenCount,
            outputTokens: usage?.candidatesTokenCount,
            inputSizeBytes: inputSize, 
            outputSizeBytes: new TextEncoder().encode(response.text).length
        });
        
        return { ...audit, timestamp: Date.now() };
    } catch (e: any) {
        console.error("[ShadowAudit] Fault:", e);
        return null;
    }
}

export async function generateLectureScript(
  topic: string, 
  channelContext: string,
  language: 'en' | 'zh' = 'en',
  channelId?: string,
  voiceName?: string,
  force: boolean = false,
  customSystemInstruction?: string,
  cumulativeContext?: string
): Promise<GeneratedLecture | null> {
  const category = 'NEURAL_CORE';
  const model = 'gemini-3-pro-preview';

  try {
    const contentUid = await generateContentUid(topic, channelContext, language);
    
    if (!force) {
      const cached = await getCloudCachedLecture(channelId || 'global', contentUid, language);
      if (cached) {
          logger.success(`Registry Cache Hit: ${contentUid}`, { category: 'VFS_LEDGER' });
          return cached;
      }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
        Topic: "${topic}"
        Knowledge Base Context: "${channelContext}"
        ${cumulativeContext ? `KNOWLEDGE ALREADY COVERED (DO NOT REPEAT): "${cumulativeContext}"` : ''}
        
        INSTRUCTION:
        1. Synthesize a deep Socratic technical lecture.
        2. BRIDGE from the previous context if available.
        3. Do NOT repeat code or concepts already summarized in the knowledge base.
        4. Focus on NEW advanced details.
    `;

    const { response, attempts, latency, inputSize } = await runWithDeepTelemetry(async () => {
        return await ai.models.generateContent({
            model, 
            contents: prompt,
            config: { 
                systemInstruction: customSystemInstruction || "You are an expert technical educator. Respond in JSON format.",
                responseMimeType: 'application/json'
            }
        });
    }, "Node Refraction", category, prompt);

    const text = response.text;
    if (!text) return null;

    const usage = response.usageMetadata;
    const parsed = JSON.parse(text.replace(/^```json\s*|```\s*$/g, '').trim());
    
    const result: GeneratedLecture = {
      uid: contentUid, topic, professorName: parsed.professorName || "Professor",
      studentName: parsed.studentName || "Student", sections: parsed.sections || [],
      readingMaterial: parsed.readingMaterial, homework: parsed.homework
    };
    
    // Automatic reasoning verification
    const audit = await performNeuralLensAudit(result, language);
    if (audit) result.audit = audit;

    if (auth.currentUser) {
        incrementApiUsage(auth.currentUser.uid);
        await deductCoins(auth.currentUser.uid, AI_COSTS.TEXT_REFRACTION);
        await saveCloudCachedLecture(channelId || 'global', contentUid, language, result);
    }

    logger.success(`Refactor Step Secured: ${topic}`, { 
        category, latency, model, retryCount: attempts,
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        inputSizeBytes: inputSize, 
        outputSizeBytes: new TextEncoder().encode(text).length
    });

    return result;
  } catch (error: any) {
    return null;
  }
}

export async function generateDesignDocFromTranscript(
    transcript: TranscriptItem[], 
    meta: { date: string, topic: string, segmentIndex?: number },
    language: 'en' | 'zh' = 'en'
): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const transcriptStr = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n').substring(0, 30000);
    const langPrompt = language === 'zh' ? 'Output in Simplified Chinese.' : 'Output in English.';
    
    const prompt = `Synthesize a comprehensive Technical Specification based on this transcript.\n\nMETADATA:\n- Date: ${meta.date}\n- Topic: ${meta.topic}\n\n${langPrompt}\n\nTRANSCRIPT:\n${transcriptStr}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
        });
        return response.text || null;
    } catch (e) {
        return null;
    }
}

export async function summarizeDiscussionAsSection(transcript: TranscriptItem[]): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const text = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n').substring(0, 10000);
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Summarize this technical discussion into a single concise paragraph. Focus on key decisions.\n\nTRANSCRIPT:\n${text}`,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || '';
    } catch (e) {
        return "Summary generation failed.";
    }
}
