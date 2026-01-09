
import { GoogleGenAI } from '@google/genai';
import { GeneratedLecture, TranscriptItem } from '../types';
import { incrementApiUsage } from './firestoreService';
import { auth } from './firebaseConfig';
import { resolvePersona } from '../utils/aiRegistry';

function safeJsonParse(text: string): any {
  try {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(json)?/i, '').replace(/```$/, '');
    }
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Error:", e, "Input:", text);
    return null;
  }
}

export async function generateLectureScript(
  topic: string, 
  channelContext: string,
  language: 'en' | 'zh' = 'en',
  channelId?: string,
  voiceName?: string
): Promise<GeneratedLecture | null> {
  try {
    // ALWAYS instantiate per-request
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Resolve identity and model from registry
    const persona = resolvePersona(voiceName || '');
    const modelName = persona.modelId;

    const langInstruction = language === 'zh' 
      ? 'Output Language: Simplified Chinese (Mandarin).' 
      : 'Output Language: English.';

    const systemInstruction = `${persona.systemInstruction} You are now acting as an expert educator. ${langInstruction}`;
    
    const userPrompt = `
      Topic: "${topic}"
      Context: "${channelContext}"
      
      Create a conversational dialogue (Teacher vs Student). 
      Include a "readingMaterial" section in Markdown.
      Include a "homework" section in Markdown.

      Return ONLY JSON:
      {
        "professorName": "${persona.displayName}",
        "studentName": "Student",
        "sections": [ {"speaker": "Teacher", "text": "..."}, {"speaker": "Student", "text": "..."} ],
        "readingMaterial": "...",
        "homework": "..."
      }
    `;

    const response = await ai.models.generateContent({
        model: modelName, 
        contents: userPrompt,
        config: { 
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json'
        }
    });

    const parsed = safeJsonParse(response.text || '');
    if (!parsed) return null;
    
    if (auth?.currentUser) {
        incrementApiUsage(auth.currentUser.uid).catch(() => {});
    }

    return {
      topic,
      professorName: parsed.professorName || persona.displayName,
      studentName: parsed.studentName || "Student",
      sections: parsed.sections || [],
      readingMaterial: parsed.readingMaterial,
      homework: parsed.homework
    };
  } catch (error: any) {
    console.error("Failed to generate lecture:", error);
    
    // Handle specific tuned model access issues
    if (error.message?.includes("Requested entity was not found") && (window as any).aistudio) {
        (window as any).aistudio.openSelectKey();
    }
    
    return null;
  }
}

export async function summarizeDiscussionAsSection(
  transcript: TranscriptItem[],
  currentLecture: GeneratedLecture,
  language: 'en' | 'zh'
): Promise<GeneratedLecture['sections'] | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chatLog = transcript.map(t => `${t.role}: ${t.text}`).join('\n');
    const systemInstruction = `Summarize Q&A into formal dialogue. Return JSON only.`;
    const userPrompt = `Context: ${currentLecture.topic}\nLog: ${chatLog}`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: userPrompt,
        config: { 
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json' 
        }
    });
    
    const parsed = safeJsonParse(response.text || '');
    return parsed ? parsed.sections : null;
  } catch (error) { return null; }
}

export async function generateDesignDocFromTranscript(
  transcript: TranscriptItem[],
  meta: { date: string; topic: string; segmentIndex?: number; },
  language: 'en' | 'zh' = 'en'
): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chatLog = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
    const systemInstruction = `You are a Senior Technical Writer.`;
    const userPrompt = `Convert discussion to Design Doc: ${meta.topic}. Log: ${chatLog}`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', 
        contents: userPrompt,
        config: { systemInstruction: systemInstruction }
    });
    return response.text || null;
  } catch (error) { return null; }
}
