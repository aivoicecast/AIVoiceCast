import { GoogleGenAI, Type } from '@google/genai';
import { GeneratedLecture, TranscriptItem, NeuralLensAudit, DependencyNode, DependencyLink } from '../types';
import { getCloudCachedLecture, saveCloudCachedLecture, deductCoins, AI_COSTS, incrementApiUsage, getUserProfile, updateUserProfile } from './firestoreService';
import { auth } from './firebaseConfig';
import { generateContentUid, generateSecureId } from '../utils/idUtils';
import { logger } from './logger';
import { checkOpenClawAvailability, requestRetinaAudit } from './openClawService';
import { generateMemberIdentity, signPayment } from '../utils/cryptoUtils';
import { getLocalPrivateKey, saveLocalPrivateKey } from '../utils/db';

const MAX_RETRIES = 3;

/**
 * Sanitizes the API key to ensure it is trimmed and not a placeholder.
 */
function getSanitizedKey(): string {
    const raw = (process.env.API_KEY || '').trim();
    if (!raw || raw === 'YOUR_GEMINI_API_KEY_HERE') {
        return '';
    }
    return raw;
}

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
    const key = getSanitizedKey();
    if (!key) return "API Key Missing.";
    
    const ai = new GoogleGenAI({ apiKey: key });
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
    const key = getSanitizedKey();
    if (!key) return brokenSource;

    const ai = new GoogleGenAI({ apiKey: key });
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
 * NOW INCLUDES: Sovereign VPR signing logic.
 */
export async function performNeuralLensAudit(
    lecture: GeneratedLecture, 
    language: 'en' | 'zh' = 'en',
    force: boolean = false,
    channelId?: string
): Promise<NeuralLensAudit | null> {
    const category = 'SHADOW_AUDIT';
    const model = 'gemini-3-pro-image-preview';
    const reportUuid = generateSecureId();
    
    // Check for OpenClaw (Neural Retina) override
    try {
        const isOpenClawReady = await checkOpenClawAvailability();
        if (isOpenClawReady) {
            logger.info("Routing Audit to Neural Retina (OpenClaw)...", { category, topic: lecture.topic });
            const retinaAudit = await requestRetinaAudit(lecture, force);
            if (retinaAudit) {
                logger.audit(`Neural Retina Verified [Score: ${retinaAudit.StructuralCoherenceScore}%]`, { 
                    category: 'NEURAL_RETINA', 
                    topic: lecture.topic,
                    model: 'openclaw-v1'
                });
                return retinaAudit;
            }
        }
    } catch (err) {
        logger.warn("OpenClaw Retina unavailable, falling back to Gemini.", { category, error: err });
    }

    if (!lecture.sections || lecture.sections.length === 0) {
        logger.error("Shadow Audit Refused: Empty logic node.", null, { category });
        return null;
    }

    try {
        const currentHash = await computeContentHash(lecture);

        if (!force && lecture.audit && lecture.audit.contentHash === currentHash && lecture.audit.signature) {
            logger.audit(`BYPASS [Node: ${lecture.topic}]: Fingerprint Match. [CACHE_HIT]`, { 
                category: 'BYPASS_LEDGER', 
                topic: lecture.topic,
                hash: currentHash.substring(0, 8),
                model: 'CACHED'
            });
            return { ...lecture.audit, timestamp: Date.now() };
        }

        const preProfile = auth.currentUser ? await getUserProfile(auth.currentUser.uid) : null;
        const preBalance = preProfile?.coinBalance || 0;

        logger.info(`Starting Shadow Audit for node: ${lecture.topic} [CACHE_MISS]`, { category, hash: currentHash.substring(0, 8) });

        if (typeof window !== 'undefined' && (window as any).aistudio) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey) await (window as any).aistudio.openSelectKey();
        }

        const key = getSanitizedKey();
        if (!key) throw new Error("API Key Missing.");

        const ai = new GoogleGenAI({ apiKey: key });
        const content = lecture.sections.map(s => `${s.speaker}: ${s.text}`).join('\n');

        const isOfficialPlatform = channelId === 'platform-core' || 
                                   channelId === 'neural-prism-platform-official' || 
                                   channelId === 'judge-deep-dive' ||
                                   channelId === 'hackathon-pitch' ||
                                   channelId?.startsWith('system-');

        const substrateMapping = isOfficialPlatform
            ? `2. SUBSTRATE MAPPING: Use 'googleSearch' to locate specific implementation files in https://github.com/aivoicecast/AIVoiceCast that correspond to these invariants.
3. RECURSIVE URI VERIFICATION (RUV): Verify architectural claims against code symbols discovered.`
            : `2. SUBSTRATE MAPPING: Use 'googleSearch' to verify architectural claims against established technical standards and public documentation.
3. RECURSIVE VERIFICATION: Do NOT assume any link to the AIVoiceCast GitHub repository unless the topic is explicitly about the Neural Prism platform architecture.`;

        const systemInstruction = `You are the Shadow Agent verifier (Tool B) for Neural Prism.
Your task is to perform an ADVERSARIAL AUDIT on input from Tool A (Studio Generator).

SYMBOLIC PARITY HANDSHAKE (SPH) PROTOCOL:
1. INTENT EXTRACTION: Decompose unstructured audit content into a set of "Logical Invariants".
${substrateMapping}
4. RESOLUTION: Identify semantic discrepancies between "Intended Logic" and "Actual Logic".

MERMAID SYNTAX RULES (STRICT ENFORCEMENT):
- EVERY NODE label MUST be enclosed in double quotes inside brackets: ID["Label Text (With Spaces or Parens)"].
- Example: Lec12["Lecture 12: Advanced Topics"]
- NEVER use raw text or parentheses inside brackets without double quotes.

OUTPUT REQUIREMENTS:
1. Extract architectural concepts and represent them as a DAG logic mesh (Mermaid graph TD).
2. BIAS CHECK: Flag "Agreeability Bias" if Tool A skips technical friction.
3. MACHINE INTERFACE: Provide strictly formatted JSON for the self-feedback loop.`;

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
                            machineFeedback: { type: Type.STRING },
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
        const usage = response.usageMetadata;
        const outputSize = new TextEncoder().encode(response.text).length;
        
        let postBalance = preBalance;
        let signature = undefined;
        let signerPublicKey = undefined;

        if (auth.currentUser) {
            const uid = auth.currentUser.uid;
            await deductCoins(uid, AI_COSTS.TECHNICAL_EVALUATION);
            await incrementApiUsage(uid);
            const postProfile = await getUserProfile(uid);
            postBalance = postProfile?.coinBalance || 0;

            // --- SOVEREIGN VPR SIGNING IMPLEMENTATION ---
            // This satisfies Node 4 of the Technical Audit
            let pKey = await getLocalPrivateKey(uid);
            if (!pKey) {
                // Provision new identity if missing
                const identity = await generateMemberIdentity();
                await saveLocalPrivateKey(uid, identity.privateKey);
                await updateUserProfile(uid, { publicKey: identity.publicKey });
                pKey = identity.privateKey;
                signerPublicKey = identity.publicKey;
            } else {
                signerPublicKey = postProfile?.publicKey;
            }

            const signPayload = {
                v: '12.9.5',
                score: audit.StructuralCoherenceScore,
                drift: audit.LogicalDriftRisk,
                hash: currentHash,
                ts: Date.now()
            };
            // Perform ECDSA P-256 signature on the reasoning artifact
            signature = await signPayment(pKey, signPayload);
        }

        logger.audit(`Audit Refraction Verified [Score: ${audit.StructuralCoherenceScore}%]`, {
            category,
            latency,
            model,
            inputTokens: usage?.promptTokenCount,
            outputTokens: usage?.candidatesTokenCount,
            inputSizeBytes: inputSize,
            outputSizeBytes: outputSize,
            topic: lecture.topic,
            preBalance,
            postBalance,
            cost: AI_COSTS.TECHNICAL_EVALUATION
        });

        logger.loop(`Tool B (Lens) feedback dispatched to Tool A (Studio).`, {
            category: 'SELF_FEEDBACK_LOOP',
            senderTool: 'NeuralLens_Verifier',
            receiverTool: 'Studio_Generator',
            machineContent: {
                coherence: audit.StructuralCoherenceScore,
                drift: audit.LogicalDriftRisk,
                feedback: audit.machineFeedback,
                vpr_signature: signature
            }
        });

        return { 
            ...audit, 
            coherenceScore: audit.StructuralCoherenceScore,
            driftRisk: audit.LogicalDriftRisk,
            robustness: audit.AdversarialRobustness,
            timestamp: Date.now(),
            reportUuid,
            contentHash: currentHash,
            signature,
            signerId: auth.currentUser?.uid,
            signerPublicKey
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
      if (cached) {
          logger.success(`VFS: Hydrated ${topic} from Cloud Registry. [CACHE_HIT]`, { 
              category, 
              model: 'CACHED',
              topic: topic
          });
          return cached;
      }
    }

    const preProfile = auth.currentUser ? await getUserProfile(auth.currentUser.uid) : null;
    const preBalance = preProfile?.coinBalance || 0;

    const key = getSanitizedKey();
    if (!key) throw new Error("API Key Missing.");

    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = `Topic: "${topic}"\nKnowledge Base Context: "${channelContext}"\n${cumulativeContext ? `KNOWLEDGE ALREADY COVERED: "${cumulativeContext}"` : ''}`;

    logger.info(`Initiating Logic Synthesis for: ${topic} [CACHE_MISS]`, { category, model });

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

    const usage = response.usageMetadata;
    const outputSize = new TextEncoder().encode(response.text).length;

    let postBalance = preBalance;
    if (auth.currentUser) {
        await deductCoins(auth.currentUser.uid, AI_COSTS.TEXT_REFRACTION);
        await incrementApiUsage(auth.currentUser.uid);
        const postProfile = await getUserProfile(auth.currentUser.uid);
        postBalance = postProfile?.coinBalance || 0;
    }

    logger.success(`Logic Node Synthesized: ${topic}`, {
        category,
        latency,
        model,
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        inputSizeBytes: inputSize,
        outputSizeBytes: outputSize,
        preBalance,
        postBalance,
        cost: AI_COSTS.TEXT_REFRACTION,
        topic: topic
    });

    const parsed = JSON.parse(response.text.trim());
    const result: GeneratedLecture = {
      uid: contentUid, 
      topic, 
      professorName: parsed.professorName || "Professor",
      studentName: parsed.studentName || "Student", 
      sections: parsed.sections || []
    };

    const audit = await performNeuralLensAudit(result, language, false, channelId);
    if (audit) result.audit = audit;

    if (auth.currentUser) {
        await saveCloudCachedLecture(channelId || 'global', contentUid, language, result);
    }
    
    return result;
  } catch (error: any) {
    logger.error(`Synthesis Refused for ${topic}`, error, { category });
    return null;
  }
}

export async function generateDesignDocFromTranscript(
    transcript: TranscriptItem[], 
    meta: { date: string, topic: string, segmentIndex?: number },
    language: 'en' | 'zh' = 'en'
): Promise<string | null> {
    const key = getSanitizedKey();
    if (!key) return null;

    const ai = new GoogleGenAI({ apiKey: key });
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
    const key = getSanitizedKey();
    if (!key) return "API Key Missing.";

    const ai = new GoogleGenAI({ apiKey: key });
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
