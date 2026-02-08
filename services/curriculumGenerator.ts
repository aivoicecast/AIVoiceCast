
import { GoogleGenAI, Type } from '@google/genai';
import { Chapter } from '../types';
import { incrementApiUsage, deductCoins, AI_COSTS, getUserProfile } from './firestoreService';
import { auth } from './firebaseConfig';
import { logger } from './logger';

export async function generateCurriculum(
  topic: string, 
  context: string,
  language: 'en' | 'zh' = 'en'
): Promise<Chapter[] | null> {
  const category = 'CURRICULUM_SYNTHESIS';
  const model = 'gemini-3-flash-preview';
  const startTime = performance.now();

  try {
    const preProfile = auth.currentUser ? await getUserProfile(auth.currentUser.uid) : null;
    const preBalance = preProfile?.coinBalance || 0;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Design a 10-chapter learning path for topic: "${topic}". Context: ${context}`;
    const inputSizeBytes = new TextEncoder().encode(prompt).length;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { 
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subTopics: {
                type: Type.ARRAY,
                items: { type: Type.OBJECT, properties: { title: { type: Type.STRING } }, required: ["title"] }
              }
            },
            required: ["title", "subTopics"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Null refraction.");

    const usage = response.usageMetadata;
    const outputSizeBytes = new TextEncoder().encode(text).length;
    const parsed = JSON.parse(text);

    let postBalance = preBalance;
    if (auth.currentUser) {
        incrementApiUsage(auth.currentUser.uid);
        await deductCoins(auth.currentUser.uid, AI_COSTS.CURRICULUM_SYNTHESIS);
        const postProfile = await getUserProfile(auth.currentUser.uid);
        postBalance = postProfile?.coinBalance || 0;
    }

    logger.success(`Curriculum Refraction Secured`, { 
        category, latency: performance.now() - startTime, model,
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        inputSizeBytes, outputSizeBytes,
        preBalance, postBalance
    });

    return parsed.map((ch: any, cIdx: number) => ({
      id: `ch-${Date.now()}-${cIdx}`,
      title: ch.title,
      subTopics: ch.subTopics.map((sub: any, sIdx: number) => ({
        id: `sub-${Date.now()}-${cIdx}-${sIdx}`,
        title: sub.title
      }))
    }));
  } catch (error: any) {
    logger.error(`Curriculum Refraction Fault`, error, { category });
    return null;
  }
}
