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
 * Uses SHA-256 Content Fingerprinting for logical consistency.
 */

/**
 * Computes a deterministic SHA-256 fingerprint for the lecture content.
 */
async function computeContentHash(lecture: GeneratedLecture): Promise<string> {
    const raw = lecture.sections.map(s => `${s.speaker}:${s.text}`).join('|');
    const msgBuffer = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

/**
 * Repairs PlantUML or Mermaid syntax errors using Gemini 3 Flash.
 */
export async function repairPlantUML(brokenSource: string, format: 'puml' | 'mermaid' = 'mermaid'): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `The following ${format === 'puml' ? 'PlantUML' : 'Mermaid.js'} code has a syntax error. 
            TASK: 
            1. Find the error.
            2. Re-write the code using the ABSOLUTE SIMPLEST syntax.
            3. For Mermaid: Use 'graph TD'. Use node IDs like 'A[Label]'.
            4. For PlantUML: Use 'rectangle' for nodes.
            5. Return ONLY the corrected code without markdown wrappers.
            
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
 * ARCHITECTURAL BREADCRUMB: NEURAL_LENS_INSTRUMENTATION_PROTOCOL
 * Implements the Shadow Agent Verification Loop.
 * Targets Grounding Root: https://github.com/aivoicecast/AIVoiceCast
 */
export async function performNeuralLensAudit(
    lecture: GeneratedLecture, 
    language: 'en' | 'zh' = 'en',
    force: boolean = false
): Promise<NeuralLensAudit | null> {
    const category = 'SHADOW_AUDIT';
    const model = 'gemini-3-pro-image-preview';
    const reportUuid = generateSecureId();
    const version = "12.9.5-INTEGRITY";
    
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
                hash: currentHash.substring(0, 8),
                integrity: 'verified'
            });
            return {
                ...lecture.audit,
                timestamp: Date.now()
            };
        }

        // MANDATORY API KEY SELECTION
        if (typeof window !== 'undefined' && (window as any).aistudio) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await (window as any).aistudio.openSelectKey();
            }
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const content = lecture.sections.map(s => `${s.speaker}: ${s.text}`).join('\n');

        const systemInstruction = `You are the Shadow Agent verifier for Neural Prism.
Your task is to perform an ADVERSARIAL AUDIT:
1. Extract architectural concepts and represent them as a DAG logic mesh.
2. DEFAULT DIAGRAM: Use Mermaid.js (graph TD).
3. LEGACY DIAGRAM: Provide PlantUML (rectangle nodes only).
4. CRITICAL SYMBOLIC PARITY: Node IDs must be alphanumeric and simple.
5. MERMAID SYNTAX: Use 'graph TD' as the root. Use A[Label] --> B[Label]. Avoid custom keywords.
6. AUDIT: Verify against the official repository at https://github.com/aivoicecast/AIVoiceCast.
7. BIAS CHECK: Flag "Agreeability Bias" if the content skips technical friction or relies on utopian claims without implementation detail.
8. RUNTIME TRACE: Generate a Mermaid sequenceDiagram for the internal app handshakes performed.

Return valid JSON.`;

        logger.info(`INIT_AUDIT [ID: ${reportUuid.substring(0,8)}]: Probing Node "${lecture.topic}"...`, { 
            category, 
            reportUuid,
            topic: lecture.topic,
            mass: `${(content.length / 1024).toFixed(2)}KB`
        });

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
                        required: ["StructuralCoherenceScore", "LogicalDriftRisk", "AdversarialRobustness", "mermaid", "plantuml", "runtime_trace_mermaid", "graph", "probes"]
                    }
                }
            });
        }, "Integrity Audit Refraction", category, content);

        if (!response.text) throw new Error("Null reasoning shard.");

        const audit = JSON.parse(response.text.replace(/^```json\s*|```\s*$/g, '').trim());
        const usage = response.usageMetadata;

        logger.success(`AUDIT_SECURED [ID: ${reportUuid.substring(0,8)}]: "${lecture.topic}" verified.`, {
            category,
            topic: lecture.topic,
            model,
            latency: Math.round(latency),
            inputTokens: usage?.promptTokenCount,
            outputTokens: usage?.candidatesTokenCount,
            totalTokens: usage?.totalTokenCount,
            inputSizeBytes: inputSize,
            outputSizeBytes: new TextEncoder().encode(response.text).length,
            coherence: `${audit.StructuralCoherenceScore}%`,
            searchApplied: !!response.candidates?.[0]?.groundingMetadata
        });
        
        return { 
            ...audit, 
            coherenceScore: audit.StructuralCoherenceScore,
            driftRisk: audit.LogicalDriftRisk,
            robustness: audit.AdversarialRobustness,
            timestamp: Date.now(),
            version,
            reportUuid,
            contentHash: currentHash
        };
    } catch (e: any) {
        logger.error(`Audit Fault [Node: ${lecture.topic}]`, e, { category, reportUuid });
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

    const preProfile = auth.currentUser ? await getUserProfile(auth.currentUser.uid) : null;
    const preBalance = preProfile?.coinBalance || 0;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Topic: "${topic}"\nKnowledge Base Context: "${channelContext}"\n${cumulativeContext ? `KNOWLEDGE ALREADY COVERED: "${cumulativeContext}"` : ''}`;

    const { response, latency, inputSize } = await runWithDeepTelemetry(async () => {
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

    const parsed = JSON.parse(response.text.replace(/^```json\s*|```\s*$/g, '').trim());
    const usage = response.usageMetadata;

    const result: GeneratedLecture = {
      uid: contentUid, 
      topic, 
      professorName: parsed.professorName || "Professor",
      studentName: parsed.studentName || "Student", 
      sections: parsed.sections || []
    };

    const audit = await performNeuralLensAudit(result, language);
    if (audit) result.audit = audit;

    let postBalance = preBalance;
    if (auth.currentUser) {
        incrementApiUsage(auth.currentUser.uid);
        const updatedProfile = await deductCoins(auth.currentUser.uid, AI_COSTS.TEXT_REFRACTION);
        postBalance = updatedProfile?.coinBalance || (preBalance - AI_COSTS.TEXT_REFRACTION);
        await saveCloudCachedLecture(channelId || 'global', contentUid, language, result);
    }

    logger.info(`CORE_SYNTHESIS: Node "${topic}" manifested.`, {
        category,
        model,
        latency: Math.round(latency),
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
        inputSizeBytes: inputSize,
        outputSizeBytes: new TextEncoder().encode(response.text).length,
        preBalance,
        postBalance,
        cost: AI_COSTS.TEXT_REFRACTION
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