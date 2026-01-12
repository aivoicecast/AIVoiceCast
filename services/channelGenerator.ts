
import { GoogleGenAI } from '@google/genai';
import { Channel, Chapter } from '../types';
import { incrementApiUsage, getUserProfile } from './firestoreService';
import { auth } from './firebaseConfig';
import { generateLectureScript } from './lectureGenerator';
import { cacheLectureScript } from '../utils/db';
import { OPENAI_API_KEY } from './private_keys';

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

async function getAIProvider(): Promise<'gemini' | 'openai'> {
    let provider: 'gemini' | 'openai' = 'gemini';
    if (auth.currentUser) {
        try {
            const profile = await getUserProfile(auth.currentUser.uid);
            if (profile?.subscriptionTier === 'pro' && profile?.preferredAiProvider === 'openai') {
                provider = 'openai';
            }
        } catch (e) { console.warn("Failed to check user profile for AI provider preference", e); }
    }
    return provider;
}

async function callOpenAI(systemPrompt: string, userPrompt: string, apiKey: string, model: string = 'gpt-4o'): Promise<string | null> {
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
                response_format: { type: "json_object" }
            })
        });
        if (!response.ok) { console.error("OpenAI Error:", await response.json()); return null; }
        const data = await response.json();
        return data.choices[0]?.message?.content || null;
    } catch (e) { console.error("OpenAI Fetch Error:", e); return null; }
}

export async function generateChannelFromPrompt(
  userPrompt: string, 
  currentUser: any,
  language: 'en' | 'zh' = 'en'
): Promise<Channel | null> {
  try {
    const provider = await getAIProvider();
    const openaiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    let activeProvider = provider;
    if (provider === 'openai' && !openaiKey) activeProvider = 'gemini';

    const langInstruction = language === 'zh' 
      ? 'Output Language: Chinese.' 
      : 'Output Language: English.';

    const systemPrompt = `You are a "Consultative Podcast Producer". 
    If the user request is broad, your job is to AUTOMATICALLY narrow it down to a specific, unique, and highly interesting angle for a 15-minute conversational series.
    Each lesson in the curriculum is intended to be rich in content with specialized personas.
    ${langInstruction}`;

    const userRequest = `
      User Request: "${userPrompt}"

      Task: 
      1. RE-DEFINE the concept to be more specific and interesting.
      2. Generate a professional Title, Description, and AI Host Instruction.
      3. Design a "Curriculum" with exactly 5-10 sub-topics.
      4. Each sub-topic should support a future conversational lecture.
      
      Return ONLY valid JSON:
      {
        "title": "Refined Catchy Title",
        "description": "Engaging description of the narrowed topic",
        "voiceName": "Select from: ${VOICES.join(', ')}",
        "systemInstruction": "Host persona prompt...",
        "tags": ["..."],
        "welcomeMessage": "Greeting...",
        "starterPrompts": ["..."],
        "chapters": [ { "title": "Main Path", "subTopics": [ {"title": "Lesson 1: ..."} ] } ]
      }
    `;

    let text: string | null = null;

    if (activeProvider === 'openai') {
        text = await callOpenAI(systemPrompt, userRequest, openaiKey);
    } else {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `${systemPrompt}\n\n${userRequest}`,
            config: { 
                responseMimeType: 'application/json'
            }
        });
        text = response.text || null;
    }

    if (!text) return null;
    const parsed = JSON.parse(text);
    const channelId = crypto.randomUUID();
    if (auth.currentUser) incrementApiUsage(auth.currentUser.uid);

    return {
      id: channelId,
      title: parsed.title,
      description: parsed.description,
      author: currentUser?.displayName || 'Anonymous Creator',
      ownerId: currentUser?.uid,
      visibility: 'private',
      voiceName: parsed.voiceName,
      systemInstruction: parsed.systemInstruction,
      likes: 0,
      dislikes: 0,
      comments: [],
      tags: parsed.tags || ['AI', 'Generated'],
      imageUrl: '', 
      welcomeMessage: parsed.welcomeMessage,
      starterPrompts: parsed.starterPrompts,
      createdAt: Date.now(),
      chapters: parsed.chapters?.map((ch: any, cIdx: number) => ({
        id: `ch-${channelId}-${cIdx}`,
        title: ch.title,
        subTopics: ch.subTopics?.map((sub: any, sIdx: number) => ({
           id: `sub-${channelId}-${cIdx}-${sIdx}`,
           title: sub.title
        })) || []
      })) || []
    };
  } catch (error) { return null; }
}

export async function modifyCurriculumWithAI(
  currentChapters: Chapter[],
  userPrompt: string,
  language: 'en' | 'zh' = 'en'
): Promise<Chapter[] | null> {
  try {
    const provider = await getAIProvider();
    const openaiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    let activeProvider = provider;
    if (provider === 'openai' && !openaiKey) activeProvider = 'gemini';
    const systemPrompt = `You are a Curriculum Editor.`;
    const userRequest = `User wants: ${userPrompt}. Current: ${JSON.stringify(currentChapters)}`;
    let text: string | null = null;
    if (activeProvider === 'openai') {
        text = await callOpenAI(systemPrompt, userRequest, openaiKey);
    } else {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `${systemPrompt}\n\n${userRequest}`,
            config: { responseMimeType: 'application/json' }
        });
        text = response.text || null;
    }
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (parsed?.chapters) {
        const timestamp = Date.now();
        return parsed.chapters.map((ch: any, cIdx: number) => ({
            id: `ch-edit-${timestamp}-${cIdx}`,
            title: ch.title,
            subTopics: Array.isArray(ch.subTopics) ? ch.subTopics.map((s: any, sIdx: number) => ({ id: `sub-edit-${timestamp}-${cIdx}-${sIdx}`, title: typeof s === 'string' ? s : s.title })) : []
        }));
    }
    return null;
  } catch (error) { return null; }
}

export async function generateChannelFromDocument(
  source: { text?: string, url?: string },
  currentUser: any,
  language: 'en' | 'zh' = 'en'
): Promise<Channel | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const langInstruction = language === 'zh' ? 'Output Language: Chinese.' : 'Output Language: English.';
    
    const systemPrompt = `You are an expert Podcast Producer. Your task is to analyze the provided source and transform it into a structured, engaging podcast channel.`;
    
    const userRequest = `Create a Podcast Channel based on this source. Return ONLY a JSON object with: title, description, voiceName, systemInstruction, tags, and chapters (with subTopics).`;

    let parts: any[] = [{ text: `${systemPrompt}\n${langInstruction}\n\n${userRequest}` }];

    if (source.url) {
        // NEW GEMINI API: Direct HTTPS URL ingestion
        parts.push({
            fileData: {
                mimeType: source.url.endsWith('.pdf') ? 'application/pdf' : 'text/plain',
                fileUri: source.url
            }
        });
    } else if (source.text) {
        parts.push({ text: `SOURCE TEXT:\n${source.text.substring(0, 100000)}` });
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });

    const text = response.text;
    if (!text) return null;
    
    const parsed = JSON.parse(text);
    const channelId = crypto.randomUUID();
    
    return {
      id: channelId,
      title: parsed.title,
      description: parsed.description,
      author: currentUser?.displayName || 'Anonymous',
      ownerId: currentUser?.uid,
      visibility: 'private',
      voiceName: parsed.voiceName || 'Zephyr',
      systemInstruction: parsed.systemInstruction,
      likes: 0, dislikes: 0, comments: [], tags: parsed.tags || [],
      imageUrl: '', 
      createdAt: Date.now(),
      chapters: parsed.chapters?.map((ch: any, i: number) => ({ 
          id: `ch-${i}`, 
          title: ch.title, 
          subTopics: ch.subTopics.map((s: any, j: number) => ({ 
              id: `s-${i}-${j}`, 
              title: s.title || s 
          })) 
      })) || []
    };
  } catch (error) { 
      console.error("Neural Document Parse Failure:", error);
      return null; 
  }
}
