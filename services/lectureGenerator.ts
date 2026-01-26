
import { GoogleGenAI } from '@google/genai';
import { GeneratedLecture, TranscriptItem } from '../types';
import { getCloudCachedLecture, saveCloudCachedLecture, deductCoins, AI_COSTS, incrementApiUsage } from './firestoreService';
import { auth } from './firebaseConfig';

async function generateContentUid(topic: string, context: string, lang: string): Promise<string> {
    const data = `${topic}|${context}|${lang}`;
    const msgBuffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

export async function generateLectureScript(
  topic: string, 
  channelContext: string,
  language: 'en' | 'zh' = 'en',
  channelId?: string,
  voiceName?: string,
  force: boolean = false
): Promise<GeneratedLecture | null> {
  try {
    const contentUid = await generateContentUid(topic, channelContext, language);
    
    // 1. Handshake with Knowledge Database (Skip if force is true)
    if (!force) {
      const cached = await getCloudCachedLecture(channelId || 'global', contentUid, language);
      if (cached) {
          window.dispatchEvent(new CustomEvent('neural-log', { 
              detail: { text: `[Ledger] Cache Hit: ${contentUid}.`, type: 'success' } 
          }));
          return cached;
      }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // RESOLVE TUNED MODELS
    let modelName = 'gemini-3-pro-preview';
    if (voiceName) {
        if (voiceName.includes('0648937375')) modelName = 'gen-lang-client-0648937375';
        else if (voiceName.includes('0375218270')) modelName = 'gen-lang-client-0375218270';
    }

    window.dispatchEvent(new CustomEvent('neural-log', { 
        detail: { text: `[Neural Core] ${force ? 'FORCING' : 'INITIALIZING'} Handshake with ${modelName}...`, type: force ? 'warn' : 'info' } 
    }));

    const langInstruction = language === 'zh' ? 'Output Language: Chinese.' : 'Output Language: English.';
    const systemInstruction = `
        You are an expert educator on the Neural Prism Platform. 
        ${langInstruction}
        Format your response as a standard JSON lecture object.
    `;
    
    const userPrompt = `
      Topic: "${topic}"
      Context: "${channelContext}"
      
      Generate a conversational JSON lecture:
      {
        "professorName": "Teacher Name",
        "studentName": "Student Name",
        "sections": [ {"speaker": "Teacher", "text": "..."}, {"speaker": "Student", "text": "..."} ],
        "readingMaterial": "Markdown...",
        "homework": "Markdown..."
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

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    const result: GeneratedLecture = {
      uid: contentUid,
      topic,
      professorName: parsed.professorName || "Professor",
      studentName: parsed.studentName || "Student",
      sections: parsed.sections || [],
      readingMaterial: parsed.readingMaterial,
      homework: parsed.homework
    };
    
    if (auth.currentUser) {
        incrementApiUsage(auth.currentUser.uid);
        deductCoins(auth.currentUser.uid, AI_COSTS.TEXT_REFRACTION);
        await saveCloudCachedLecture(channelId || 'global', contentUid, language, result);
    }

    return result;
  } catch (error) {
    console.error("Failed to generate lecture:", error);
    return null;
  }
}

export async function summarizeDiscussionAsSection(
  transcript: TranscriptItem[],
  language: 'en' | 'zh' = 'en'
): Promise<{ speaker: string; text: string } | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const fullTranscript = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
    const langInstruction = language === 'zh' ? 'Output Language: Chinese.' : 'Output Language: English.';
    
    const prompt = `Summarize the following discussion into a cohesive educational section from a "Teacher" persona. ${langInstruction}\n\nDISCUSSION:\n${fullTranscript}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });

    return { speaker: 'Teacher', text: response.text || '' };
  } catch (error) {
    return null;
  }
}

export async function generateDesignDocFromTranscript(
  transcript: TranscriptItem[],
  metadata: { date: string; topic: string; segmentIndex?: number },
  language: 'en' | 'zh' = 'en'
): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const fullTranscript = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
    const langInstruction = language === 'zh' ? 'Output Language: Chinese.' : 'Output Language: English.';
    
    const prompt = `Generate a professional Technical Specification based on the transcript. ${langInstruction}\n\nMETADATA: ${JSON.stringify(metadata)}\n\nTRANSCRIPT:\n${fullTranscript}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt
    });

    return response.text || null;
  } catch (error) {
    return null;
  }
}
