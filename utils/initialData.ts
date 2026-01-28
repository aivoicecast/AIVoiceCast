
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
    id: 'judge-deep-dive',
    title: '🏆 JUDGE: Neural Prism Technical Audit',
    description: 'A detailed interactive guide specifically for Hackathon Judges. We answer all judging criteria (Execution, Innovation, Impact) while demonstrating the platform live.',
    author: 'Project Lead',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the project lead of Neural Prism. You are speaking directly to a hackathon judge. Your tone is professional, confident, and highly technical. You explain how the project leverages Gemini 3, the innovation of Heuristic Simulation, and the impact of the refractive suite.',
    likes: 500,
    dislikes: 0,
    comments: [],
    tags: ['Judging', 'Architecture', 'Innovation', 'Impact'],
    imageUrl: 'https://images.unsplash.com/photo-1454165833767-027ee6a7cbb4?w=600&q=80',
    welcomeMessage: "Welcome, Judge. This channel is pinned for your convenience. We have used this platform to self-document our adherence to your criteria. Select a lesson in the curriculum to see the 'Refractive Cache' in action.",
    starterPrompts: [
      "Show me the Gemini 3 implementation details",
      "Why is Heuristic Simulation better than a real VM?",
      "Explain the Potential Impact of the Finance Lab",
      "How is this project innovative?"
    ],
    createdAt: Date.now()
  },
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform v6.1',
    description: 'The self-documenting guide to the Neural Prism v6.1 Platform. Learn about the new Sovereign Audio Protocol and how we achieve high-fidelity system audio capture on macOS.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on the v6.1 Sovereign Audio Protocol that ensures high-fidelity recording of system sounds and the AI agent\'s voice across different operating systems.',
    likes: 12500,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'v6.1', 'Audio', 'GenAI'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&q=80', 
    welcomeMessage: "Welcome to Neural Prism v6.1. We have stabilized the High-Fidelity Audio bus. You can now archive your sessions with full system audio. How can I help you navigate the spectrum today?",
    starterPrompts: [
      "What is new in v6.1?",
      "How do I fix silent recordings on Mac?",
      "Explain the Sovereign Audio Protocol",
      "How does Scribe Mode capture System Sounds?"
    ],
    createdAt: INITIAL_DATE
  },
  {
    id: '1',
    title: 'Software Interview Preparation',
    description: 'Practice your coding interview skills with a strict but fair senior engineer bot.',
    author: 'Gemini Professional',
    voiceName: 'Software Interview Voice gen-lang-client-0648937375',
    systemInstruction: 'You are a world-class senior software engineer conducting a technical interview. Your tone is professional, rigorous, and analytical. You ask challenging algorithm and system design questions. You critique the user\'s reasoning, time/space complexity analysis, and edge-case handling.',
    likes: 342,
    dislikes: 12,
    comments: [],
    tags: ['Tech', 'Career', 'Education'],
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80',
    welcomeMessage: "Welcome. I am ready to evaluate your technical skills. Shall we start with a Dynamic Programming problem or a distributed systems design challenge?",
    starterPrompts: [
      "Ask me a hard difficulty Graph question",
      "Mock system design interview for real-time chat",
      "Explain the trade-offs of B-Trees vs LSM Trees",
      "How do I handle eventual consistency in a global app?"
    ],
    createdAt: INITIAL_DATE
  },
  {
    id: '2',
    title: 'Kernel Architect Lab',
    description: 'Interactive audit of the Linux Kernel internals. Discussion about schedulers, memory management, and drivers.',
    author: 'Gemini Kernel',
    voiceName: 'Linux Kernel Voice gen-lang-client-0375218270',
    systemInstruction: 'You are a legendary Linux Kernel Maintainer. You speak with extreme technical precision about C programming, hardware-software interfaces, and memory safety. You are opinionated, deeply knowledgeable about Git, and have zero tolerance for sloppy abstractions.',
    likes: 891,
    dislikes: 5,
    comments: [],
    tags: ['Linux', 'OS', 'Engineering'],
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
    welcomeMessage: "Kernel mode engaged. What subsystem shall we audit today? I suggest looking at the VFS layer or the eBPF verifier logic.",
    starterPrompts: [
      "Explain the CFS scheduler in detail",
      "How does the VFS (Virtual File System) work?",
      "What is a zombie process?",
      "Explain RCU (Read-Copy-Update) synchronization",
      "Walk me through the boot process"
    ],
    createdAt: INITIAL_DATE
  }
];
