
import { GoogleGenAI } from '@google/genai';
import { Channel, Chapter } from '../types';
import { incrementApiUsage, getUserProfile } from './firestoreService';
import { auth } from './firebaseConfig';
import { generateLectureScript } from './lectureGenerator';
import { cacheLectureScript } from '../utils/db';
import { GEMINI_API_KEY, OPENAI_API_KEY } from './private_keys';

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

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
        } catch (e) { console.warn("Failed to check user profile for AI provider preference", e); }
    }
    return provider;
}

// OpenAI Helper
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
      ? 'Output Language: Simplified Chinese (Mandarin) for all content.' 
      : 'Output Language: English.';

    const systemPrompt = `You are a creative Podcast Producer AI. ${langInstruction}`;
    const userRequest = `
      User Request: "${userPrompt}"

      Task: 
      1. Create a complete concept for a podcast channel based on the user's request.
      2. Generate a catchy Title and engaging Description.
      3. Define a "System Instruction" for the AI Host. It should define a specific persona (e.g., "You are an excited historian...").
      4. Select the best Voice Personality from this list: ${VOICES.join(', ')}.
      5. Generate 3-5 Tags.
      6. Create a "Welcome Message" for the live session.
      7. Create 4 "Starter Prompts" for the live session.
      8. Design a "Curriculum" with 3-5 Chapters, each having 3-5 Sub-topics.

      Return ONLY a raw JSON object with this structure:
      {
        "title": "...",
        "description": "...",
        "voiceName": "...",
        "systemInstruction": "...",
        "tags": ["..."],
        "welcomeMessage": "...",
        "starterPrompts": ["..."],
        "chapters": [
          {
            "title": "Chapter Title",
            "subTopics": [ {"title": "Subtopic Title"} ]
          }
        ],
        "imagePrompt": "A description of the podcast cover art visual style"
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
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 4000 }
            }
        });
        text = response.text || null;
    }

    if (!text) return null;

    const parsed = JSON.parse(text);
    const channelId = crypto.randomUUID();
    
    if (auth.currentUser) incrementApiUsage(auth.currentUser.uid);

    const newChannel: Channel = {
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
      imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(parsed.imagePrompt || parsed.title)}?width=600&height=400&nologo=true`,
      welcomeMessage: parsed.welcomeMessage,
      starterPrompts: parsed.starterPrompts,
      createdAt: Date.now(), // Ensure creation time is set
      chapters: parsed.chapters?.map((ch: any, cIdx: number) => ({
        id: `ch-${channelId}-${cIdx}`,
        title: ch.title,
        subTopics: ch.subTopics?.map((sub: any, sIdx: number) => ({
           id: `sub-${channelId}-${cIdx}-${sIdx}`,
           title: sub.title
        })) || []
      })) || []
    };

    // Auto-Generate First Lecture Content
    if (newChannel.chapters.length > 0 && newChannel.chapters[0].subTopics.length > 0) {
        const firstTopic = newChannel.chapters[0].subTopics[0];
        const lecture = await generateLectureScript(firstTopic.title, newChannel.description, language);
        if (lecture) {
            const cacheKey = `lecture_${channelId}_${firstTopic.id}_${language}`;
            await cacheLectureScript(cacheKey, lecture);
        }
    }

    return newChannel;

  } catch (error) {
    console.error("Channel Generation Failed:", error);
    return null;
  }
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

    const langInstruction = language === 'zh' ? 'Output Language: Chinese.' : 'Output Language: English.';
    const systemPrompt = `You are a Curriculum Editor AI. ${langInstruction}`;
    
    const userRequest = `
      User Instruction: "${userPrompt}"
      
      Current Curriculum JSON:
      ${JSON.stringify(currentChapters.map(c => ({ title: c.title, subTopics: c.subTopics.map(s => s.title) })))}

      Task:
      1. Modify the curriculum structure based strictly on the User Instruction.
      2. You can ADD chapters, REMOVE chapters, ADD lessons (sub-topics), or RENAME items.
      3. Keep the structure logical.
      4. If the user asks to "Add a chapter about X", create it with 3-4 relevant sub-topics.

      Return ONLY the new JSON structure:
      {
        "chapters": [
          {
            "title": "...",
            "subTopics": [ "..." ]
          }
        ]
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
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 4000 }
            }
        });
        text = response.text || null;
    }

    if (!text) return null;
    if (auth.currentUser) incrementApiUsage(auth.currentUser.uid);
    
    const parsed = JSON.parse(text);
    
    if (parsed && parsed.chapters && Array.isArray(parsed.chapters)) {
        const timestamp = Date.now();
        return parsed.chapters.map((ch: any, cIdx: number) => ({
            id: `ch-edit-${timestamp}-${cIdx}`,
            title: ch.title,
            subTopics: Array.isArray(ch.subTopics) 
              ? ch.subTopics.map((subTitle: string, sIdx: number) => ({
                  id: `sub-edit-${timestamp}-${cIdx}-${sIdx}`,
                  title: subTitle
                }))
              : []
        }));
    }
    return null;

  } catch (error) {
    console.error("Curriculum Modification Failed", error);
    return null;
  }
}

export async function generateChannelFromDocument(
  documentText: string,
  currentUser: any,
  language: 'en' | 'zh' = 'en'
): Promise<Channel | null> {
  try {
    const provider = await getAIProvider();
    const openaiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    let activeProvider = provider;
    if (provider === 'openai' && !openaiKey) activeProvider = 'gemini';

    const langInstruction = language === 'zh' ? 'Output Language: Simplified Chinese (Mandarin).' : 'Output Language: English.';
    const safeText = documentText.substring(0, 30000);

    const systemPrompt = `You are a Podcast Producer. ${langInstruction}`;
    const userRequest = `
      Analyze the following document and convert it into a Podcast Channel structure.
      
      Document:
      "${safeText}"

      Task:
      1. Extract a suitable Title and Description for the Podcast Channel based on the document.
      2. Define a System Instruction and Voice Name (Select one: Puck, Charon, Kore, Fenrir, Zephyr).
      3. Structure the content into a Curriculum (Chapters and Subtopics).
         - If the document has explicit Chapters (e.g., "Chapter 1"), use them.
         - If it's a single long text with sections, group them logically.
         - SubTopic titles should be descriptive (e.g. "The Problem Space", "CRDT Architecture").
      4. Generate Tags, Welcome Message, and Starter Prompts.
      5. Generate an image prompt for the cover art.

      Return ONLY a raw JSON object with this structure:
      {
        "title": "...",
        "description": "...",
        "voiceName": "...",
        "systemInstruction": "...",
        "tags": ["..."],
        "welcomeMessage": "...",
        "starterPrompts": ["..."],
        "chapters": [
          {
            "title": "Chapter Title",
            "subTopics": [ {"title": "Subtopic Title"} ]
          }
        ],
        "imagePrompt": "..."
      }
    `;

    let text: string | null = null;

    if (activeProvider === 'openai') {
        text = await callOpenAI(systemPrompt, userRequest, openaiKey, 'gpt-4o'); 
    } else {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `${systemPrompt}\n\n${userRequest}`,
            config: { 
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 4000 }
            }
        });
        text = response.text || null;
    }

    if (!text) return null;

    const parsed = JSON.parse(text);
    const channelId = crypto.randomUUID();
    
    if (auth.currentUser) incrementApiUsage(auth.currentUser.uid);

    const newChannel: Channel = {
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
      tags: parsed.tags || ['Document', 'AI'],
      imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(parsed.imagePrompt || parsed.title)}?width=600&height=400&nologo=true`,
      welcomeMessage: parsed.welcomeMessage,
      starterPrompts: parsed.starterPrompts,
      createdAt: Date.now(), // Ensure creation time is set
      chapters: parsed.chapters?.map((ch: any, cIdx: number) => ({
        id: `ch-${channelId}-${cIdx}`,
        title: ch.title,
        subTopics: ch.subTopics?.map((sub: any, sIdx: number) => ({
           id: `sub-${channelId}-${cIdx}-${sIdx}`,
           title: sub.title
        })) || []
      })) || []
    };

    return newChannel;

  } catch (error) {
    console.error("Document Import Failed:", error);
    return null;
  }
}
