
import { GoogleGenAI } from '@google/genai';
import { GeneratedLecture, SubTopic, TranscriptItem } from '../types';
import { incrementApiUsage, getUserProfile } from './firestoreService';
import { auth } from './firebaseConfig';
import { GEMINI_API_KEY, OPENAI_API_KEY } from './private_keys';

// Helper to safely parse JSON from AI response
function safeJsonParse(text: string): any {
  try {
    // Remove markdown code blocks if present
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

// --- OPENAI HELPER ---
async function callOpenAI(
    systemPrompt: string, 
    userPrompt: string, 
    apiKey: string,
    model: string = 'gpt-4o'
): Promise<string | null> {
    try {
        // FIX: The endpoint for text generation must be chat/completions, not audio/speech.
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
                response_format: { type: "json_object" } // Force JSON
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

// Helper to decide provider
async function getAIProvider(): Promise<'gemini' | 'openai'> {
    let provider: 'gemini' | 'openai' = 'gemini';
    
    if (auth.currentUser) {
        try {
            const profile = await getUserProfile(auth.currentUser.uid);
            // PRO CHECK: Only pro members can use OpenAI preference
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
  channelId?: string
): Promise<GeneratedLecture | null> {
  try {
    const provider = await getAIProvider();
    const openaiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    // If preferred is OpenAI but key missing, fallback to Gemini
    let activeProvider = provider;
    if (provider === 'openai' && !openaiKey) {
        console.warn("OpenAI Key missing, falling back to Gemini");
        activeProvider = 'gemini';
    }

    const langInstruction = language === 'zh' 
      ? 'Output Language: Simplified Chinese (Mandarin). Ensure natural phrasing appropriate for Chinese speakers.' 
      : 'Output Language: English.';

    const systemPrompt = `You are an expert educational content creator. ${langInstruction}`;
    
    const userPrompt = `
      Topic: "${topic}"
      Context: "${channelContext}"
      
      Task:
      1. Identify a famous expert, scientist, or historical figure relevant to this topic to act as the "Teacher" (e.g., Richard Feynman for Physics, Li Bai for Poetry).
      2. Identify a "Student" name.
      3. Create a natural, engaging dialogue between them.
         - NO "Hi Teacher" or robotic greetings. Jump straight into the intellectual discussion.
         - The Teacher explains concepts vividly.
         - The Student challenges ideas or asks for clarification.
         - Keep it around 300-500 words.

      Return the result ONLY as a JSON object with this structure:
      {
        "professorName": "Name of Professor",
        "studentName": "Name of Student",
        "sections": [
          {"speaker": "Teacher", "text": "..."},
          {"speaker": "Student", "text": "..."}
        ]
      }
    `;

    let text: string | null = null;

    if (activeProvider === 'openai') {
        text = await callOpenAI(systemPrompt, userPrompt, openaiKey);
    } else {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const modelName = (channelId === '1' || channelId === '2') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
        
        const response = await ai.models.generateContent({
            model: modelName, 
            contents: `${systemPrompt}\n\n${userPrompt}`,
            config: { 
                responseMimeType: 'application/json',
                thinkingConfig: (modelName === 'gemini-3-pro-preview') ? { thinkingBudget: 4000 } : undefined
            }
        });
        text = response.text || null;
    }

    if (!text) return null;

    const parsed = safeJsonParse(text);
    if (!parsed) return null;
    
    if (auth.currentUser) {
       incrementApiUsage(auth.currentUser.uid);
    }

    return {
      topic,
      professorName: parsed.professorName || (language === 'zh' ? "教授" : "Professor"),
      studentName: parsed.studentName || (language === 'zh' ? "学生" : "Student"),
      sections: parsed.sections || []
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

    const langInstruction = language === 'zh' 
      ? 'Output Language: Simplified Chinese (Mandarin).' 
      : 'Output Language: English.';

    const systemPrompt = `You are an expert educational content creator. ${langInstruction}`;
    
    const userPrompt = `
      Channel Context: "${channelContext}"
      Chapter Title: "${chapterTitle}"

      Task: Generate a short educational dialogue (lecture) for EACH of the following sub-topics.
      
      Sub-topics to generate:
      ${JSON.stringify(subTopics.map(s => ({ id: s.id, title: s.title })))}

      For EACH sub-topic:
      1. Assign a Teacher (Famous Expert) and Student persona appropriate for the topic.
      2. Write a 300-400 word dialogue.
      3. Maintain high educational value.

      Return the result as a single JSON object where the keys are the "id" of the sub-topic, and the value is the lecture object.
      
      Structure:
      {
        "results": [
           {
             "id": "SUBTOPIC_ID_FROM_INPUT",
             "lecture": {
                "professorName": "...",
                "studentName": "...",
                "sections": [ {"speaker": "Teacher", "text": "..."} ]
             }
           }
        ]
      }
    `;

    let text: string | null = null;

    if (activeProvider === 'openai') {
        text = await callOpenAI(systemPrompt, userPrompt, openaiKey);
    } else {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: `${systemPrompt}\n\n${userPrompt}`,
            config: { responseMimeType: 'application/json' }
        });
        text = response.text || null;
    }

    if (!text) return null;

    const parsed = safeJsonParse(text);
    if (!parsed) return null;

    const resultMap: Record<string, GeneratedLecture> = {};

    if (parsed.results && Array.isArray(parsed.results)) {
      parsed.results.forEach((item: any) => {
        const original = subTopics.find(s => s.id === item.id);
        if (original && item.lecture) {
           resultMap[item.id] = {
             topic: original.title,
             professorName: item.lecture.professorName,
             studentName: item.lecture.studentName,
             sections: item.lecture.sections
           };
        }
      });
    }
    
    if (auth.currentUser) {
       incrementApiUsage(auth.currentUser.uid);
    }

    return resultMap;

  } catch (error) {
    console.error("Failed to generate batch lectures:", error);
    return null;
  }
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
    const langInstruction = language === 'zh' ? 'Output Chinese' : 'Output English';

    const systemPrompt = `You are an editor summarazing a student-teacher Q&A session. ${langInstruction}`;
    const userPrompt = `
      Original Topic: "${currentLecture.topic}"
      
      Chat Transcript:
      ${chatLog}
      
      Task:
      Convert this loose Q&A transcript into a formal "Advanced Q&A" segment for the lecture script.
      - Keep the "Teacher" (${currentLecture.professorName}) and "Student" (${currentLecture.studentName}) personas.
      - Summarize the key insights from the chat.
      - Format it as a dialogue (sections).
      - Add a section header like "--- Discussion Summary ---" at the start.

      Return JSON:
      {
        "sections": [ {"speaker": "Teacher", "text": "..."} ]
      }
    `;

    let text: string | null = null;

    if (activeProvider === 'openai') {
        text = await callOpenAI(systemPrompt, userPrompt, openaiKey);
    } else {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: `${systemPrompt}\n\n${userPrompt}`,
            config: { responseMimeType: 'application/json' }
        });
        text = response.text || null;
    }

    if (!text) return null;
    if (auth.currentUser) incrementApiUsage(auth.currentUser.uid);

    const parsed = safeJsonParse(text);
    return parsed ? parsed.sections : null;
  } catch (error) {
    console.error("Summarization failed", error);
    return null;
  }
}

export async function generateDesignDocFromTranscript(
  transcript: TranscriptItem[],
  meta: {
    date: string;
    topic: string;
    segmentIndex?: number;
  },
  language: 'en' | 'zh' = 'en'
): Promise<string | null> {
  try {
    const provider = await getAIProvider();
    const openaiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    let activeProvider = provider;
    if (provider === 'openai' && !openaiKey) activeProvider = 'gemini';

    const chatLog = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
    const langInstruction = language === 'zh' ? 'Output Language: Chinese.' : 'Output Language: English.';

    const systemPrompt = `You are a Senior Technical Writer. ${langInstruction}`;
    const userPrompt = `
      Task: Convert the following casual discussion transcript into a Formal Design Document (Markdown).
      
      CRITICAL: Use the exact date provided in the metadata. Do not generate a fake date.
      
      Metadata:
      - Date: "${meta.date}"
      - Topic: "${meta.topic}"
      ${meta.segmentIndex !== undefined ? `- Original Segment Reference ID: seg-${meta.segmentIndex}` : ''}

      Transcript:
      ${chatLog}
      
      Structure the output clearly with the following sections (use Markdown headers):
      # Design Document: ${meta.topic}
      **Date:** ${meta.date}
      ${meta.segmentIndex !== undefined ? `**Reference:** Linked to [Lecture Segment #${meta.segmentIndex + 1}](#seg-${meta.segmentIndex})` : ''}
      
      # Executive Summary
      Brief overview of the discussion goals and outcomes.
      
      # Key Requirements & Constraints
      Bullet points of what was decided or constrained.
      
      # Proposed Solution / Architecture
      Detailed explanation of the solution discussed. If technical, include code snippets or system diagrams (text-based).
      
      # Q&A / Clarifications
      Important questions asked and the answers provided.
      
      # Action Items / Next Steps
      List of tasks derived from the conversation.
      
      Note: Remove filler words and conversational fluff. Make it professional.
    `;

    let text: string | null = null;

    if (activeProvider === 'openai') {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            })
        });
        if(response.ok) {
            const data = await response.json();
            text = data.choices[0]?.message?.content || null;
        }
    } else {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: `${systemPrompt}\n\n${userPrompt}`,
            config: {
                thinkingConfig: { thinkingBudget: 4000 }
            }
        });
        text = response.text || null;
    }

    if (auth.currentUser) incrementApiUsage(auth.currentUser.uid);

    return text;
  } catch (error) {
    console.error("Design Doc generation failed", error);
    return null;
  }
}
