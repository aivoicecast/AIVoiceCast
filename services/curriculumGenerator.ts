import { GoogleGenAI } from '@google/genai';
import { Chapter } from '../types';
import { incrementApiUsage } from './firestoreService';
import { auth } from './firebaseConfig';

export async function generateCurriculum(
  topic: string, 
  context: string,
  language: 'en' | 'zh' = 'en'
): Promise<Chapter[] | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const langInstruction = language === 'zh' 
      ? 'Output Language: Simplified Chinese (Mandarin). Use professional academic terminology.'
      : 'Output Language: English.';

    const prompt = `
      You are an expert curriculum designer. Design a 10-chapter learning path for a podcast about: "${topic}".
      Context: ${context}
      ${langInstruction}
      
      Requirements:
      1. Exactly 10 chapters.
      2. Each chapter should have 3-5 specific sub-topics (lessons).
      3. Topics should progress from fundamentals to advanced concepts.
      
      Return ONLY a JSON array with this structure:
      [
        {
          "title": "Chapter 1: ...",
          "subTopics": [
            { "title": "Lesson 1.1: ..." }
          ]
        }
      ]
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text || "[]");
    if (auth.currentUser) incrementApiUsage(auth.currentUser.uid);

    return parsed.map((ch: any, cIdx: number) => ({
      id: `ch-${Date.now()}-${cIdx}`,
      title: ch.title,
      subTopics: ch.subTopics.map((sub: any, sIdx: number) => ({
        id: `sub-${Date.now()}-${cIdx}-${sIdx}`,
        title: sub.title
      }))
    }));
  } catch (error) {
    console.error("Failed to generate curriculum:", error);
    return null;
  }
}