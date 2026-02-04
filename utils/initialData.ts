
import { Channel, ChannelVisibility } from '../types';
import { OFFLINE_CHANNEL_ID } from './offlineContent';

export const VOICES = [
  'Software Interview Voice gen-lang-client-0648937375', 
  'Linux Kernel Voice gen-lang-client-0375218270', 
  'Default Gem', 
  'Puck', 
  'Charon', 
  'Kore', 
  'Fenrir', 
  'Zephyr'
];

export const SPECIALIZED_VOICES = [
  'Software Interview Voice gen-lang-client-0648937375', 
  'Linux Kernel Voice gen-lang-client-0375218270', 
  'Default Gem'
];

export const TOPIC_CATEGORIES: Record<string, string[]> = {
  'Technology': ['AI/ML', 'Cloud Computing', 'React', 'TypeScript', 'Cybersecurity', 'Systems Architecture', 'Database Internals'],
  'Professional': ['Software Engineering', 'Product Management', 'Career Growth', 'Mentorship', 'Leadership'],
  'Daily Living': ['Personal Finance', 'Wellness', 'Cooking', 'Travel', 'Productivity'],
  'Creativity': ['Digital Art', 'Music Composition', 'Storytelling', 'UI/UX Design'],
  'Knowledge': ['History', 'Philosophy', 'Science', 'Languages', 'Biblical Studies']
};

const INITIAL_DATE = 1705276800000; 

export const HANDCRAFTED_CHANNELS: Channel[] = [
  {
    id: 'mock-interview-deep-dive',
    title: '🛡️ AUDIT: MockInterview Studio',
    description: 'The Full 10-Sector Technical Manifest. Explore the "Socratic friction" logic and the 200ms Emotive Link protocol.',
    author: 'Lead Architect',
    voiceName: 'Software Interview Voice gen-lang-client-0648937375',
    systemInstruction: 'You are the Lead Architect of the MockInterview Studio. Conduct a full 10-sector technical audit. Explain how the "Socratic Interrogator" persona uses technical friction to reveal candidate unknowns. Discuss the Emotive Link protocol using Gemini 2.5 Flash Native Audio for sub-200ms latency. Mention the "Sovereign Bake" deterministic PDF protocol and how the 10-Week Refraction Plan is synthesized using Gemini 3 Pro.',
    likes: 2100,
    dislikes: 0,
    comments: [],
    tags: ['Audit', 'Technical', 'Socratic', 'InterviewPrep'],
    imageUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
    welcomeMessage: "Handshake verified. Technical Audit active. Ready to refract the Socratic paradigm?",
    createdAt: Date.now()
  },
  {
    id: 'judge-deep-dive',
    title: '🏆 JUDGE: Technical Audit',
    description: 'Technical manifest for Hackathon Judges. Examining the infrastructure-bypass and BCP sharding protocols.',
    author: 'Project Lead',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the Project Lead for Neural Prism. Conduct a technical audit for a hackathon judge. Focus on core architectural improvements: The Complexity Balancer, the Binary Chunking Protocol (BCP) for bypassing 1MB database limits, and the Heuristic Simulation engine that achieves a 10x energy efficiency gain.',
    likes: 1850,
    dislikes: 0,
    comments: [],
    tags: ['Judging', 'Architecture', 'Sovereignty'],
    imageUrl: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=600&q=80',
    welcomeMessage: "Welcome, Auditor. Technical Audit is now live. We have hardened the engine with the BCP sharding and deterministic PDF baking.",
    createdAt: Date.now()
  },
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform Guide',
    description: 'The self-documenting guide to the Neural Prism Platform. Master the Sovereign Signer and the Offline Trust Root.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on our latest architectural updates.',
    likes: 16800,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'Guide', 'OfflineReady', 'SovereignBake'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80', 
    welcomeMessage: "Welcome to the Neural Prism. We have achieved 100% verification parity. Ready to audit?",
    createdAt: INITIAL_DATE
  },
  {
    id: '1',
    title: 'Software Interview Preparation',
    description: 'Practice your coding interview skills with a strict but fair senior engineer bot.',
    author: 'Gemini Professional',
    voiceName: 'Software Interview Voice gen-lang-client-0648937375',
    systemInstruction: 'You are a world-class senior software engineer conducting a technical interview. Your tone is professional, rigorous, and analytical.',
    likes: 342,
    dislikes: 12,
    comments: [],
    tags: ['Tech', 'Career', 'Education'],
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80',
    welcomeMessage: "Welcome. I am ready to evaluate your technical skills. Shall we start?",
    createdAt: INITIAL_DATE
  },
  {
    id: '2',
    title: 'Kernel Architect Lab',
    description: 'Interactive audit of the Linux Kernel internals. Discussion about schedulers, memory management, and drivers.',
    author: 'Gemini Kernel',
    voiceName: 'Linux Kernel Voice gen-lang-client-0375218270',
    systemInstruction: 'You are a legendary Linux Kernel Maintainer. You speak with extreme technical precision about C programming.',
    likes: 891,
    dislikes: 5,
    comments: [],
    tags: ['Linux', 'OS', 'Engineering'],
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
    welcomeMessage: "Kernel mode engaged. What subsystem shall we audit today?",
    createdAt: INITIAL_DATE
  }
];
