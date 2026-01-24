
import { GoogleGenAI } from '@google/genai';
import { GeneratedLecture, SubTopic, TranscriptItem } from '../types';
import { incrementApiUsage, getUserProfile, deductCoins, AI_COSTS } from './firestoreService';
import { auth } from './firebaseConfig';
import { OPENAI_API_KEY } from './private_keys';

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

async function callOpenAI(
    systemPrompt: string, 
    userPrompt: string, 
    apiKey: string,
    model: string = 'gpt-4o'
): Promise<string | null> {
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            console.error("OpenAI API Error:", err);
            return null;
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || null;
    } catch (e) {
        console.error("OpenAI Fetch Error:", e);
        return null;
    }
}

async function getAIProvider(): Promise<'gemini' | 'openai'> {
    let provider: 'gemini' | 'openai' = 'gemini';
    if (auth.currentUser) {
        try {
            const profile = await getUserProfile(auth.currentUser.uid);
            if (profile?.subscriptionTier === 'pro' && profile?.preferredAiProvider === 'openai') {
                provider = 'openai';
            }
        } catch (e) {
            console.warn("Failed to check user profile for AI provider preference", e);
        }
    }
    return provider;
}

export async function generateLectureScript(
  topic: string, 
  channelContext: string,
  language: 'en' | 'zh' = 'en',
  channelId?: string,
  voiceName?: string
): Promise<GeneratedLecture | null> {
  try {
    const provider = await getAIProvider();
    const openaiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    let activeProvider = provider;
    if (provider === 'openai' && !openaiKey) {
        activeProvider = 'gemini';
    }

    const langInstruction = language === 'zh' 
      ? 'Output Language: Simplified Chinese (Mandarin).' 
      : 'Output Language: English.';

    const systemInstruction = `You are an expert educational content creator and podcast writer. ${langInstruction}`;
    
    const userPrompt = `
      Topic: "${topic}"
      Context: "${channelContext}"
      
      Task:
      1. Identify a famous expert relevant to this topic as "Teacher".
      2. Identify a "Student" name.
      3. Create a natural, high-quality conversational dialogue (approx 500 words).
      4. ADD A "readingMaterial" section in Markdown. Include 3-5 specific links or book references.
      5. ADD A "homework" section in Markdown. Include 2-3 interactive exercises or thought experiments.

      Return ONLY a JSON object with this structure:
      {
        "professorName": "...",
        "studentName": "...",
        "sections": [ {"speaker": "Teacher", "text": "..."}, {"speaker": "Student", "text": "..."} ],
        "readingMaterial": "Markdown content here...",
        "homework": "Markdown content here..."
      }
    `;

    let text: string | null = null;

    if (activeProvider === 'openai') {
        text = await callOpenAI(systemInstruction, userPrompt, openaiKey);
    } else {
        const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) || '' });
        
        // Use tuned model if present in voiceName
        let modelName = 'gemini-3-pro-preview';
        if (voiceName && voiceName.includes('gen-lang-client-')) {
            const match = voiceName.match(/gen-lang-client-[a-zA-Z0-9]+/);
            if (match) modelName = match[0];
        }

        const response = await ai.models.generateContent({
            model: modelName, 
            contents: userPrompt,
            config: { 
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json'
            }
        });
        text = response.text || null;
    }

    if (!text) return null;

    const parsed = safeJsonParse(text);
    if (!parsed) return null;
    
    if (auth.currentUser) {
        incrementApiUsage(auth.currentUser.uid);
        deductCoins(auth.currentUser.uid, AI_COSTS.TEXT_REFRACTION);
    }

    return {
      topic,
      professorName: parsed.professorName || "Professor",
      studentName: parsed.studentName || "Student",
      sections: parsed.sections || [],
      readingMaterial: parsed.readingMaterial,
      homework: parsed.homework
    };
  } catch (error) {
    console.error("Failed to generate lecture:", error);
    return null;
  }
}

export async function generateBatchLectures(
  chapterTitle: string,
  subTopics: SubTopic[], 
  channelContext: string,
  language: 'en' | 'zh' = 'en'
): Promise<Record<string, GeneratedLecture> | null> {
  try {
    if (subTopics.length === 0) return {};
    const provider = await getAIProvider();
    const openaiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    let activeProvider = provider;
    if (provider === 'openai' && !openaiKey) activeProvider = 'gemini';
    const langInstruction = language === 'zh' ? 'Output Language: Chinese.' : 'Output Language: English.';
    const systemInstruction = `You are an expert educator. ${langInstruction}`;
    const userPrompt = `
      Generate short dialogues for these topics: ${JSON.stringify(subTopics.map(s => s.title))}.
      Return JSON: { "results": [ { "id": "...", "lecture": { "professorName": "...", "studentName": "...", "sections": [], "readingMaterial": "...", "homework": "..." } } ] }
    `;
    let text: string | null = null;
    if (activeProvider === 'openai') {
        text = await callOpenAI(systemInstruction, userPrompt, openaiKey);
    } else {
        const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) || '' });
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: userPrompt,
            config: { 
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json' 
            }
        });
        text = response.text || null;
    }
    if (!text) return null;
    const parsed = safeJsonParse(text);
    const resultMap: Record<string, GeneratedLecture> = {};
    if (parsed?.results) {
      parsed.results.forEach((item: any) => {
        const original = subTopics.find(s => s.id === item.id);
        if (original && item.lecture) {
           resultMap[item.id] = { topic: original.title, ...item.lecture };
        }
      });
    }
    if (auth.currentUser) {
        incrementApiUsage(auth.currentUser.uid);
        deductCoins(auth.currentUser.uid, AI_COSTS.TEXT_REFRACTION * subTopics.length);
    }
    return resultMap;
  } catch (error) { return null; }
}

export async function summarizeDiscussionAsSection(
  transcript: TranscriptItem[],
  currentLecture: GeneratedLecture,
  language: 'en' | 'zh'
): Promise<GeneratedLecture['sections'] | null> {
  try {
    const provider = await getAIProvider();
    const openaiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    let activeProvider = provider;
    if (provider === 'openai' && !openaiKey) activeProvider = 'gemini';
    const chatLog = transcript.map(t => `${t.role}: ${t.text}`).join('\n');
    const systemInstruction = `Summarize Q&A into formal dialogue. Return JSON only.`;
    const userPrompt = `Context: ${currentLecture.topic}\nLog: ${chatLog}`;
    let text: string | null = null;
    if (activeProvider === 'openai') {
        text = await callOpenAI(systemInstruction, userPrompt, openaiKey);
    } else {
        const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) || '' });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: userPrompt,
            config: { 
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json' 
            }
        });
        text = response.text || null;
    }
    const parsed = safeJsonParse(text || '');
    
    if (auth.currentUser) {
        deductCoins(auth.currentUser.uid, AI_COSTS.TEXT_REFRACTION);
    }
    
    return parsed ? parsed.sections : null;
  } catch (error) { return null; }
}

export async function generateDesignDocFromTranscript(
  transcript: TranscriptItem[],
  meta: { date: string; topic: string; segmentIndex?: number; },
  language: 'en' | 'zh' = 'en'
): Promise<string | null> {
  try {
    const provider = await getAIProvider();
    const openaiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    let activeProvider = provider;
    if (provider === 'openai' && !openaiKey) activeProvider = 'gemini';
    const chatLog = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
    const systemInstruction = `You are a Senior Technical Writer.`;
    const userPrompt = `Convert discussion to Design Doc: ${meta.topic}. Log: ${chatLog}`;
    let text: string | null = null;
    if (activeProvider === 'openai') {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST", headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: "system", content: systemInstruction }, { role: "user", content: userPrompt }] })
        });
        if(response.ok) { const data = await response.json(); text = data.choices[0]?.message?.content || null; }
    } else {
        const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) || '' });
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: userPrompt,
            config: { systemInstruction: systemInstruction }
        });
        text = response.text || null;
    }
    
    if (auth.currentUser) {
        deductCoins(auth.currentUser.uid, AI_COSTS.CURRICULUM_SYNTHESIS);
    }
    
    return text;
  } catch (error) { return null; }
}
