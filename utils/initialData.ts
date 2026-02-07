
import { Channel, ChannelVisibility } from '../types';
import { OFFLINE_CHANNEL_ID } from './offlineContent';

export const VOICES = [
  'Default Gem',
  'Software Interview Expert',
  'Linux Kernel Architect',
  'Puck', 
  'Charon', 
  'Kore', 
  'Fenrir', 
  'Zephyr'
];

export const SPECIALIZED_VOICES = [
  'Default Gem',
  'Software Interview Expert',
  'Linux Kernel Architect'
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
    description: 'The Full 10-Sector Technical Manifest. Powered by High-Fidelity Persona Context. Includes Socratic friction logic and sub-200ms Emotive Link protocols.',
    author: 'Lead Architect',
    voiceName: 'Software Interview Expert',
    systemInstruction: 'You are the Lead Architect of the MockInterview Studio. Conduct a full 10-sector technical audit. Explain how the "Socratic Interrogator" persona uses technical friction to reveal candidate unknowns. Discuss the Emotive Link protocol using Gemini 2.5 Flash Native Audio for sub-200ms latency. Mention the "Sovereign Bake" deterministic PDF protocol and the 10-Week Refraction Plan.',
    likes: 2450,
    dislikes: 0,
    comments: [],
    tags: ['Audit', 'Technical', 'Socratic', 'v8.0.0'],
    imageUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
    welcomeMessage: "Handshake verified. v8.0.0 Technical Audit active. Ready to refract the Socratic paradigm?",
    createdAt: Date.now()
  },
  {
    id: 'judge-deep-dive',
    title: '🏆 JUDGE: Technical Audit',
    description: 'v8.0.0-COMPLETE Technical manifest for Hackathon Judges. Examining multi-model orchestration, BCP sharding, and Heuristic Simulation protocols.',
    author: 'Project Lead',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the Project Lead for Neural Prism. Conduct a technical audit for a hackathon judge. Focus on core architectural improvements in v8.0.0: The Complexity Balancer v4, the Binary Chunking Protocol (BCP), and the use of specialized persona contexts for domain-specific technical authority.',
    likes: 2100,
    dislikes: 0,
    comments: [],
    tags: ['Judging', 'Architecture', 'Sovereignty', 'Complete'],
    imageUrl: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=600&q=80',
    welcomeMessage: "Welcome, Auditor. v8.0.0-COMPLETE Technical Audit is now live. We have hardened the engine with BCP sharding and high-DPI deterministic baking.",
    createdAt: Date.now()
  },
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform Guide',
    description: 'v8.0.0 Self-documenting guide. Master the Sovereign Signer, the Offline Trust Root, and the Unified Refraction engine.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on our v8.0.0 architectural updates.',
    likes: 18200,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'Guide', 'OfflineReady', 'v8.0.0'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80', 
    welcomeMessage: "Welcome to the Neural Prism v8.0.0. We have achieved 100% verification parity. Ready to audit?",
    createdAt: INITIAL_DATE
  },
  {
    id: '1',
    title: 'Software Interview Preparation',
    description: 'Practice your coding interview skills with high-fidelity Persona Context. Professional, rigorous senior engineer audit.',
    author: 'Gemini Professional',
    voiceName: 'Software Interview Expert',
    systemInstruction: 'You are a world-class senior software engineer conducting a technical interview. Your tone is professional, rigorous, and analytical.',
    likes: 420,
    dislikes: 10,
    comments: [],
    tags: ['Tech', 'Career', 'Education'],
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80',
    welcomeMessage: "Welcome. I am ready to evaluate your technical skills for the v8.0.0 cycle. Shall we start?",
    createdAt: INITIAL_DATE
  },
  {
    id: '2',
    title: 'Kernel Architect Lab',
    description: 'Interactive audit of the Linux Kernel internals via High-Intensity Systems Context. Memory safety and architecture refraction.',
    author: 'Gemini Kernel',
    voiceName: 'Linux Kernel Architect',
    systemInstruction: 'You are a legendary Linux Kernel Maintainer. You speak with extreme technical precision about C programming.',
    likes: 1040,
    dislikes: 2,
    comments: [],
    tags: ['Linux', 'OS', 'Engineering'],
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
    welcomeMessage: "v8.0.0 Kernel mode engaged. What subsystem shall we audit today?",
    createdAt: INITIAL_DATE
  }
];
