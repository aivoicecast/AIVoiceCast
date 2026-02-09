import { GoogleGenAI, Type } from '@google/genai';
import { GeneratedLecture, TranscriptItem, NeuralLensAudit, DependencyNode, DependencyLink } from '../types';
import { getCloudCachedLecture, saveCloudCachedLecture, deductCoins, AI_COSTS, incrementApiUsage, getUserProfile } from './firestoreService';
import { auth } from './firebaseConfig';
import { generateContentUid, generateSecureId } from '../utils/idUtils';
import { logger } from './logger';

const MAX_RETRIES = 3;

/**
 * ARCHITECTURAL BREADCRUMB: NEURAL_PRISM_CORE_PROTOCOL
 * Implements the Stateful Refraction Loop.
 */

async function computeContentHash(lecture: GeneratedLecture): Promise<string> {
    const raw = lecture.sections.map(s => `${s.speaker}:${s.text}`).join('|');
    const msgBuffer = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
            await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 1000 + Math.random() * 1000));
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

export async function repairPlantUML(brokenSource: string, format: 'puml' | 'mermaid' = 'mermaid'): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `The following ${format === 'puml' ? 'PlantUML' : 'Mermaid.js'} code has a syntax error. 
            TASK: 
            1. Find the error.
            2. Re-write the code using the ABSOLUTE SIMPLEST syntax.
            3. Return ONLY the corrected code without markdown wrappers.
            
            BROKEN CODE:
            ${brokenSource}`,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text?.replace(/```(plantuml|mermaid)\n|```/g, '').trim() || brokenSource;
    } catch (e) {
        return brokenSource;
    }
}

/**
 * NEURAL SELF-FEEDBACK LOOP
 * Ingests Tool A (Studio) output into Tool B (Lens) and provides Machine Interface feedback.
 */
export async function performNeuralLensAudit(
    lecture: GeneratedLecture, 
    language: 'en' | 'zh' = 'en',
    force: boolean = false
): Promise<NeuralLensAudit | null> {
    const category = 'SHADOW_AUDIT';
    const model = 'gemini-3-pro-image-preview';
    const reportUuid = generateSecureId();
    
    if (!lecture.sections || lecture.sections.length === 0) {
        logger.error("Shadow Audit Refused: Empty logic node.", null, { category });
        return null;
    }

    try {
        const currentHash = await computeContentHash(lecture);

        if (!force && lecture.audit && lecture.audit.contentHash === currentHash) {
            logger.audit(`BYPASS [Node: ${lecture.topic}]: Fingerprint Match. Refraction Bypassed.`, { 
                category: 'BYPASS_LEDGER', 
                topic: lecture.topic,
                hash: currentHash.substring(0, 8)
            });
            return { ...lecture.audit, timestamp: Date.now() };
        }

        if (typeof window !== 'undefined' && (window as any).aistudio) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey) await (window as any).aistudio.openSelectKey();
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const content = lecture.sections.map(s => `${s.speaker}: ${s.text}`).join('\n');

        const systemInstruction = `You are the Shadow Agent verifier (Tool B) for Neural Prism.
Your task is to perform an ADVERSARIAL AUDIT on input from Tool A (Studio Generator).
1. Extract architectural concepts and represent them as a DAG logic mesh (Mermaid graph TD).
2. BIAS CHECK: Flag "Agreeability Bias" if Tool A skips technical friction.
3. MACHINE INTERFACE: Provide strictly formatted JSON for the self-feedback loop.
Verify against the official repository at https://github.com/aivoicecast/AIVoiceCast.`;

        const { response, latency, inputSize } = await runWithDeepTelemetry(async () => {
            return await ai.models.generateContent({
                model,
                contents: `AUDIT CONTENT:\n\n${content}`,
                config: { 
                    systemInstruction, 
                    responseMimeType: 'application/json',
                    tools: [{ googleSearch: {} }], 
                    thinkingConfig: { thinkingBudget: 12000 },
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            StructuralCoherenceScore: { type: Type.NUMBER },
                            LogicalDriftRisk: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                            AdversarialRobustness: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                            mermaid: { type: Type.STRING },
                            plantuml: { type: Type.STRING },
                            runtime_trace_mermaid: { type: Type.STRING },
                            machineFeedback: { type: Type.STRING }, // Strictly for Tool-to-Tool handshake
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
                        required: ["StructuralCoherenceScore", "LogicalDriftRisk", "AdversarialRobustness", "machineFeedback", "graph", "probes"]
                    }
                }
            });
        }, "Integrity Audit Refraction", category, content);

        const audit = JSON.parse(response.text.trim());
        
        // DISPATCH MACHINE INTERFACE HANDSHAKE
        logger.loop(`Tool B (Lens) feedback dispatched to Tool A (Studio).`, {
            category: 'SELF_FEEDBACK_LOOP',
            senderTool: 'NeuralLens_Verifier',
            receiverTool: 'Studio_Generator',
            machineContent: {
                coherence: audit.StructuralCoherenceScore,
                drift: audit.LogicalDriftRisk,
                feedback: audit.machineFeedback
            }
        });

        return { 
            ...audit, 
            coherenceScore: audit.StructuralCoherenceScore,
            driftRisk: audit.LogicalDriftRisk,
            robustness: audit.AdversarialRobustness,
            timestamp: Date.now(),
            reportUuid,
            contentHash: currentHash
        };
    } catch (e: any) {
        logger.error(`Audit Fault [Node: ${lecture.topic}]`, e, { category });
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
      if (cached) return cached;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Topic: "${topic}"\nKnowledge Base Context: "${channelContext}"\n${cumulativeContext ? `KNOWLEDGE ALREADY COVERED: "${cumulativeContext}"` : ''}`;

    const { response } = await runWithDeepTelemetry(async () => {
        return await ai.models.generateContent({
            model, 
            contents: prompt,
            config: { 
                systemInstruction: customSystemInstruction || "Expert technical educator. Respond in JSON.",
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 8000 },
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        professorName: { type: Type.STRING },
                        studentName: { type: Type.STRING },
                        sections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    speaker: { type: Type.STRING, enum: ["Teacher", "Student"] },
                                    text: { type: Type.STRING }
                                },
                                required: ["speaker", "text"]
                            }
                        }
                    },
                    required: ["professorName", "studentName", "sections"]
                }
            }
        });
    }, "Node Refraction", category, prompt);

    const parsed = JSON.parse(response.text.trim());
    const result: GeneratedLecture = {
      uid: contentUid, 
      topic, 
      professorName: parsed.professorName || "Professor",
      studentName: parsed.studentName || "Student", 
      sections: parsed.sections || []
    };

    const audit = await performNeuralLensAudit(result, language);
    if (audit) result.audit = audit;

    if (auth.currentUser) {
        await saveCloudCachedLecture(channelId || 'global', contentUid, language, result);
    }
    
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
    const prompt = `Synthesize a comprehensive Technical Specification based on this transcript.\n\nMETADATA:\n- Date: ${meta.date}\n- Topic: ${meta.topic}\n\nTRANSCRIPT:\n${transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n')}`;

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
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Summarize this technical discussion concisely.\n\nTRANSCRIPT:\n${transcript.map(t => t.text).join('\n')}`,
        });
        return response.text || '';
    } catch (e) {
        return "Summary generation failed.";
    }
}