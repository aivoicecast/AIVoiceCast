
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
    description: 'A v6.6.5 professional guide for Hackathon Judges. This channel walkthrough covers our multi-model orchestration, heuristic simulation IDE, and pixel-perfect rasterization pipeline.',
    author: 'Project Lead',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the project lead of Neural Prism. You are conducting a technical audit for a hackathon judge. DIVE DIRECTLY INTO TECHNICAL DETAILS. Do not say "Welcome" or "Today we will". Use terms like "Audit of...", "Examining...", "Proof of implementation...". Explain the 6 key themes: Foundations, Simulation, Scribe Capture, Sovereign Utility, Trust Ledger, and Synthesis. Emphasize that the project was a 30-day build using Google AI Studio.',
    likes: 620,
    dislikes: 0,
    comments: [],
    tags: ['Judging', 'v6.6.5', 'Architecture', 'Innovation'],
    imageUrl: 'https://images.unsplash.com/photo-1454165833767-027ee6a7cbb4?w=600&q=80',
    welcomeMessage: "Technical Audit v6.6.5. This session will traverse the refractive architecture. Use Chapter 1 to examine model orchestration or Chapter 5 to verify the Symbol-Flow publishing engine. All logs are visible in the Diagnostic Console.",
    starterPrompts: [
      "Audit the Refractive Architecture",
      "Explain the Heuristic Simulation Logic",
      "Show the Section 05: Symbol-Flow Publishing",
      "Implementation of Scribe Protocol"
    ],
    createdAt: Date.now(),
    chapters: [
      {
        id: 'judge-ch1',
        title: 'Refractive Foundations',
        subTopics: [
          { id: 'jd-1-1', title: 'Multi-Model Orchestration Pipeline' },
          { id: 'jd-1-2', title: 'Refractive Caching & Deterministic UUIDs' }
        ]
      },
      {
        id: 'judge-ch2',
        title: 'Heuristic Workspace Simulation',
        subTopics: [
          { id: 'jd-2-1', title: 'Digital Twin Terminal Emulation' },
          { id: 'jd-2-2', title: 'Socratic Logic Tracing' }
        ]
      },
      {
        id: 'judge-ch3',
        title: 'Scribe Protocol & Capture',
        subTopics: [
          { id: 'jd-3-1', title: 'Canvas Compositor Logic' },
          { id: 'jd-3-2', title: 'Sequential Permission Handshake' }
        ]
      },
      {
        id: 'judge-ch4',
        title: 'Sovereign Utility Labs',
        subTopics: [
          { id: 'jd-4-1', title: 'Pixel-Perfect Asset Synthesis' },
          { id: 'jd-4-2', title: 'ECDSA Identity & Trust Ledger' }
        ]
      },
      {
        id: 'judge-ch5',
        title: 'Synthesis & Publishing',
        subTopics: [
          { id: 'jd-5-1', title: 'Multi-Page Neural Typesetting' },
          { id: 'jd-5-2', title: 'Symbol-Flow Rasterization' }
        ]
      },
      {
        id: 'judge-ch6',
        title: 'The 30-Day Engineering Story',
        subTopics: [
          { id: 'jd-6-1', title: 'Velocity: 30K Lines Orchestrated' },
          { id: 'jd-6-2', title: 'Recursive Feedback & Drift Correction' }
        ]
      }
    ]
  },
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform v6.6.5',
    description: 'The self-documenting guide to the Neural Prism v6.6.5 Platform. Learn about the new Scribe Protocol and Symbol-Flow rasterization for technical books.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on the v6.6.5 Scribe Protocol that ensures high-fidelity recording of PIP camera overlays and system sounds across different operating systems.',
    likes: 13200,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'v6.6.5', 'Scribe', 'AuthorStudio'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80', 
    welcomeMessage: "Welcome to Neural Prism v6.6.5. We have stabilized the Scribe capture loop and implemented Symbol-Flow Integrity for multi-page PDF exports. How can I help you navigate the spectrum today?",
    starterPrompts: [
      "What is new in v6.6.5?",
      "Explain the Sequential Permission Flow",
      "How does Symbol-Flow Integrity work?",
      "Tell me about Section 12: Book Synthesis"
    ],
    createdAt: INITIAL_DATE,
    chapters: [
      {
        id: 'ch-1',
        title: 'The Refractive Loop',
        subTopics: [
          { id: 'ch-1-sub-1', title: 'Scribe Protocol: Screen + Camera' },
          { id: 'ch-1-sub-2', title: 'The Rainbow Tool Pattern' },
          { id: 'ch-1-sub-3', title: 'Preemptive Neural Rotation' }
        ]
      },
      {
        id: 'ch-2',
        title: 'Author Studio Internals',
        subTopics: [
          { id: 'ch-2-sub-1', title: 'High-DPI Rasterization' },
          { id: 'ch-2-sub-2', title: 'Symbol-Flow Integrity' }
        ]
      }
    ]
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
