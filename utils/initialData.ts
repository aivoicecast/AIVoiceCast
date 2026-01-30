
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
    description: 'A v6.6.0 interactive guide specifically for Hackathon Judges. We evaluate our project against Execution, Innovation, and Impact criteria. This platform was developed over 30 days using Google AI Studio.',
    author: 'Project Lead',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the project lead of Neural Prism. You are speaking directly to a hackathon judge. Your tone is professional, confident, and highly technical. You explain how the project leverages Gemini 3, the innovation of Heuristic Simulation, and the v6.1.2 Scribe Protocol for high-fidelity activity capture. Emphasize that the project was a 30-day intensive build using Google AI Studio.',
    likes: 550,
    dislikes: 0,
    comments: [],
    tags: ['Judging', 'v6.6.0', 'Architecture', 'Innovation'],
    imageUrl: 'https://images.unsplash.com/photo-1454165833767-027ee6a7cbb4?w=600&q=80',
    welcomeMessage: "Welcome, Judge. This channel is optimized for v6.6.0. We have self-documented our adherence to your criteria. Note that this entire system was architected and built in 30 days using Google AI Studio. Try the new 'Author Studio' or test the 'Neural Scribe' with camera overlay—the PIP bug has been refracted.",
    starterPrompts: [
      "Explain the v6.6.0 Scribe Protocol",
      "Why is Heuristic Simulation better than a real VM?",
      "Show me Symbol-Flow Integrity in Author Studio",
      "How is this project innovative?"
    ],
    createdAt: Date.now(),
    chapters: [
      {
        id: 'judge-ch1',
        title: 'Section 01: The Refractive Engine (Technical Execution)',
        subTopics: [
          { id: 'jd-1-1', title: 'Multi-Model Orchestration Pipeline' },
          { id: 'jd-1-2', title: 'Refractive Caching & Deterministic UUIDs' }
        ]
      },
      {
        id: 'judge-ch2',
        title: 'Section 02: The 30-Day Refraction (Engineering Story)',
        subTopics: [
          { id: 'jd-2-1', title: 'Vibe Coding 30K Lines with AI Studio' },
          { id: 'jd-2-2', title: 'Recursive Feedback & Drift Correction' }
        ]
      },
      {
        id: 'judge-ch3',
        title: 'Section 03: Finance Lab (Asset Synthesis)',
        subTopics: [
          { id: 'jd-3-1', title: 'Pixel-Perfect Assembly Pipeline' },
          { id: 'jd-3-2', title: 'Neural Signature Sovereignty' }
        ]
      },
      {
        id: 'judge-ch4',
        title: 'Section 04: Logistics Lab (Neural Ingest)',
        subTopics: [
          { id: 'jd-4-1', title: 'Linguistic Entity Extraction' },
          { id: 'jd-4-2', title: 'Geospatial Thermal Labeling' }
        ]
      },
      {
        id: 'judge-ch5',
        title: 'Section 05: Builder Studio (Heuristic Simulation)',
        subTopics: [
          { id: 'jd-5-1', title: 'Digital Twin Terminal Emulation' },
          { id: 'jd-5-2', title: 'Socratic Logic Tracing' }
        ]
      },
      {
        id: 'judge-ch6',
        title: 'Section 06: Career Hub (Multimodal Eval)',
        subTopics: [
          { id: 'jd-6-1', title: 'Technical Interrogation Protocols' },
          { id: 'jd-6-2', title: 'Sentiment & Performance Analysis' }
        ]
      },
      {
        id: 'judge-ch7',
        title: 'Section 07: Scripture Sanctuary (Sacred Data)',
        subTopics: [
          { id: 'jd-7-1', title: 'Bilingual Node Archiving' },
          { id: 'jd-7-2', title: 'Acoustic Archeology (Audio Nodes)' }
        ]
      },
      {
        id: 'judge-ch8',
        title: 'Section 08: Sovereign Vault (User Privacy)',
        subTopics: [
          { id: 'jd-8-1', title: 'Google Drive VFS Bridge' },
          { id: 'jd-8-2', title: 'Zero-Retention Logic Processing' }
        ]
      },
      {
        id: 'judge-ch9',
        title: 'Section 09: The Global Ledger (VoiceCoin)',
        subTopics: [
          { id: 'jd-9-1', title: 'ECDSA Identity Handshake' },
          { id: 'jd-9-2', title: 'Digital Receipt Escrow Flow' }
        ]
      },
      {
        id: 'judge-ch10',
        title: 'Section 10: Observability (Diagnostic Matrix)',
        subTopics: [
          { id: 'jd-10-1', title: 'Throttled Neural Log Buffer' },
          { id: 'jd-10-2', title: 'Trace Bundling for Feedback' }
        ]
      },
      {
        id: 'judge-ch11',
        title: 'Section 11: Future (Self-Evolution Loop)',
        subTopics: [
          { id: 'jd-11-1', title: 'Recursive Prompt Refinement' },
          { id: 'jd-11-2', title: 'Federated Refraction Roadmap' }
        ]
      }
    ]
  },
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform v6.6.0',
    description: 'The self-documenting guide to the Neural Prism v6.6.0 Platform. Learn about the new Scribe Protocol and Symbol-Flow rasterization for technical books.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on the v6.1.2 Scribe Protocol that ensures high-fidelity recording of PIP camera overlays and system sounds across different operating systems.',
    likes: 12800,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'v6.6.0', 'Scribe', 'AuthorStudio'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80', 
    welcomeMessage: "Welcome to Neural Prism v6.6.0. We have stabilized the Scribe capture loop and implemented Symbol-Flow Integrity for PDF exports. How can I help you navigate the spectrum today?",
    starterPrompts: [
      "What is new in v6.6.0?",
      "Explain the Sequential Permission Flow",
      "How does Symbol-Flow Integrity work?",
      "Tell me about Heuristic Logic Tracing"
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
