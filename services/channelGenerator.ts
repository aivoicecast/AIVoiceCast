
import { GoogleGenAI } from '@google/genai';
import { Channel, Chapter } from '../types';
import { incrementApiUsage, getUserProfile, deductCoins, AI_COSTS } from './firestoreService';
import { auth } from './firebaseConfig';

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export async function generateChannelFromPrompt(
  userPrompt: string, 
  currentUser: any,
  language: 'en' | 'zh' = 'en'
): Promise<Channel | null> {
  try {
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
      2. Generate a professional Title, Description, and AI Host Instruction using Gemini 3 Pro.
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

    // Create fresh instance right before call as per guidelines for dynamic key support
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `${systemPrompt}\n\n${userRequest}`,
        config: { 
            responseMimeType: 'application/json'
        }
    });
    
    const text = response.text || null;
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
      voiceName: parsed.voiceName || 'Zephyr',
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

export async function generateChannelCoverArt(title: string, description: string): Promise<string | null> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Generate a professional, high-quality, artistic podcast cover art for a series titled "${title}". 
        Context: ${description}. 
        Artistic Style: Modern, clean, 8k resolution, cinematic lighting, conceptual art. 
        Requirements: No text, no words, centered composition, striking visual metaphor for the topic.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: prompt,
            config: {
                imageConfig: {
                    aspectRatio: "1:1"
                }
            }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return null;
    } catch (error) {
        console.error("Failed to generate cover art:", error);
        return null;
    }
}

export async function modifyCurriculumWithAI(
  currentChapters: Chapter[],
  userPrompt: string,
  language: 'en' | 'zh' = 'en'
): Promise<Chapter[] | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `User wants: ${userPrompt}. Current: ${JSON.stringify(currentChapters)}`,
        config: { responseMimeType: 'application/json' }
    });
    const text = response.text || null;
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
    const langInstruction = language === 'zh' ? 'Output Language: Chinese.' : 'Output Language: English.';
    
    const systemPrompt = `You are an expert Podcast Producer powered by Gemini 3 Pro. 
    Your task is to analyze the provided source and transform it into a structured, high-fidelity podcast channel.
    If a URL is provided, browse the content to ensure 100% technical accuracy.`;

    const userRequest = `Create a complete Podcast Channel (JSON) based on this source. 
    Return ONLY a JSON object with: title, description, voiceName, systemInstruction, tags, and chapters (with subTopics).`;

    const config: any = { responseMimeType: "application/json" };
    
    // MANDATORY: Use gemini-3-pro-image-preview for googleSearch tool tasks
    const modelId = source.url ? 'gemini-3-pro-image-preview' : 'gemini-3-pro-preview';

    // Enable Google Search grounding if a URL (like a GitHub link) is provided
    if (source.url) {
        // MANDATORY API KEY SELECTION CHECK
        if (!(await (window as any).aistudio.hasSelectedApiKey())) {
            await (window as any).aistudio.openSelectKey();
        }

        config.tools = [{ googleSearch: {} }];
        window.dispatchEvent(new CustomEvent('neural-log', { 
            detail: { text: `Enabling Google Search grounding for source: ${source.url}`, type: 'audit' } 
        }));
    }

    const promptText = source.url 
        ? `${systemPrompt}\n${langInstruction}\n\nURL TO ANALYZE: ${source.url}\n\n${userRequest}`
        : `${systemPrompt}\n${langInstruction}\n\nSOURCE TEXT:\n${source.text?.substring(0, 100000)}\n\n${userRequest}`;

    // Create fresh instance right before call to ensure latest API key is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: modelId,
        contents: promptText,
        config
    });

    const text = response.text;
    if (!text) return null;

    // Log grounding sources if they exist (MANDATORY per guidelines)
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        const chunks = response.candidates[0].groundingMetadata.groundingChunks;
        const sourceUrls = chunks.map((c: any) => c.web?.uri).filter(Boolean);
        window.dispatchEvent(new CustomEvent('neural-log', { 
            detail: { 
                text: `Neural Grounding Verified. Analyzed ${chunks.length} segments from: ${sourceUrls.join(', ')}`, 
                type: 'success' 
            } 
        }));
    }

    const parsed = JSON.parse(text.replace(/^```json\s*|```\s*$/g, '').trim());
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
          subTopics: ch.subTopics.map((s: any, j: number) => ({ id: `s-${i}-${j}`, title: s.title || s })) 
      })) || []
    };
  } catch (error) { 
      console.error("Refraction Error:", error);
      return null; 
  }
}
