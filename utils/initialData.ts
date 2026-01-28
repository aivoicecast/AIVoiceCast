
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
    description: 'A v6.1.2 interactive guide specifically for Hackathon Judges. We evaluate our project against Execution, Innovation, and Impact criteria while demonstrating the platform live.',
    author: 'Project Lead',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the project lead of Neural Prism. You are speaking directly to a hackathon judge. Your tone is professional, confident, and highly technical. You explain how the project leverages Gemini 3, the innovation of Heuristic Simulation, and the v6.1.2 Scribe Protocol for high-fidelity activity capture.',
    likes: 550,
    dislikes: 0,
    comments: [],
    tags: ['Judging', 'v6.1.2', 'Architecture', 'Innovation'],
    imageUrl: 'https://images.unsplash.com/photo-1454165833767-027ee6a7cbb4?w=600&q=80',
    welcomeMessage: "Welcome, Judge. This channel is optimized for v6.1.2. We have self-documented our adherence to your criteria. Try the new 'Author Studio' or test the 'Neural Scribe' with camera overlay—the PIP bug has been refracted.",
    starterPrompts: [
      "Explain the v6.1.2 Scribe Protocol",
      "Why is Heuristic Simulation better than a real VM?",
      "Show me Symbol-Flow Integrity in Author Studio",
      "How is this project innovative?"
    ],
    createdAt: Date.now(),
    chapters: [
      {
        id: 'judge-ch1',
        title: 'Chapter 1: The Refractive Engine (Technical Execution)',
        subTopics: [
          { id: 'jd-1-1', title: 'Multi-Model Orchestration Pipeline' },
          { id: 'jd-1-2', title: 'Refractive Caching & Deterministic UUIDs' }
        ]
      },
      {
        id: 'judge-ch2',
        title: 'Chapter 2: The 30-Day Refraction (Engineering Story)',
        subTopics: [
          { id: 'jd-2-1', title: 'Vibe Coding 30K Lines with AI Studio' },
          { id: 'jd-2-2', title: 'Recursive Feedback & Drift Correction' }
        ]
      },
      {
        id: 'judge-ch3',
        title: 'Chapter 3: Neural Scribe (Activity Capture)',
        subTopics: [
          { id: 'jd-3-1', title: 'Sequential Permission Handshake' },
          { id: 'jd-3-2', title: 'Canvas Compositor & PIP Overlay' }
        ]
      },
      {
        id: 'judge-ch4',
        title: 'Chapter 4: Author Studio (Knowledge Artifacts)',
        subTopics: [
          { id: 'jd-4-1', title: 'Symbol-Flow Rasterization' },
          { id: 'jd-4-2', title: 'High-DPI PDF Synthesis Pipeline' }
        ]
      },
      {
        id: 'judge-ch5',
        title: 'Chapter 5: Finance Lab (Asset Synthesis)',
        subTopics: [
          { id: 'jd-5-1', title: 'Pixel-Perfect Document Rasterization' },
          { id: 'jd-5-2', title: 'Neural Security Seals & Watermarking' }
        ]
      },
      {
        id: 'judge-ch8',
        title: 'Chapter 8: Sovereign Vault (User Privacy)',
        subTopics: [
          { id: 'jd-8-1', title: 'OAuth2 Sovereignty: Google Drive Sync' },
          { id: 'jd-8-2', title: 'On-Device Identity (Web Crypto API)' }
        ]
      },
      {
        id: 'judge-ch10',
        title: 'Chapter 10: Observability (Diagnostic Matrix)',
        subTopics: [
          { id: 'jd-10-1', title: 'Throttled Neural Log Buffer' },
          { id: 'jd-10-2', title: 'Trace Bundling for Feedback Loops' }
        ]
      }
    ]
  },
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform v6.1.2',
    description: 'The self-documenting guide to the Neural Prism v6.1.2 Platform. Learn about the new Scribe Protocol and Symbol-Flow rasterization for technical books.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on the v6.1.2 Scribe Protocol that ensures high-fidelity recording of PIP camera overlays and system sounds across different operating systems.',
    likes: 12800,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'v6.1.2', 'Scribe', 'AuthorStudio'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&q=80', 
    welcomeMessage: "Welcome to Neural Prism v6.1.2. We have stabilized the Scribe capture loop and implemented Symbol-Flow Integrity for PDF exports. How can I help you navigate the spectrum today?",
    starterPrompts: [
      "What is new in v6.1.2?",
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
