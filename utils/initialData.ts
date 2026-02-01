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
    title: '🛡️ AUDIT: MockInterview Studio v6.8.5',
    description: 'The Full 10-Sector Technical Manifest. Explore the 10x energy efficiency proof, Hybrid Edge-Cloud vision, and the Humanoid Robotics economy.',
    author: 'Lead Architect',
    voiceName: 'Software Interview Voice gen-lang-client-0648937375',
    systemInstruction: 'You are the Lead Architect of the MockInterview Studio. Conduct a full 10-sector technical audit. Explain the v6.8.5 Hybrid Edge-Cloud vision and the 10x energy efficiency achieved via Infrastructure-Bypass. Detail the 4-tier storage matrix: IndexedDB, GitHub, Database, and Drive/YouTube. Discuss the future of Humanoid Robotics where local models provide "real" living room mentorship. Mention how idle robots earn AIVoiceCoins. End with: Thanks for the Neural Prism Platform and the Google Gemini Model that power the platform behind the things.',
    likes: 1540,
    dislikes: 0,
    comments: [],
    tags: ['Judging', 'v6.8.5', 'Innovation', 'TechnicalManifest'],
    imageUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
    welcomeMessage: "Handshake verified. Technical Audit v6.8.5-MANIFEST initiated. We are examining the complete 10-sector vision, from Socratic Interrogation to the AIVoiceCoin robotics economy. Ready to refract?",
    starterPrompts: [
        "Explain the 10x Infrastructure-Bypass logic",
        "Vision: Humanoid Robots in the Living Room",
        "How do robots earn AIVoiceCoins?",
        "Explain the Sovereign Data Matrix (10KB to 1GB)",
        "Audit the Shorten the Gap protocol"
    ],
    createdAt: Date.now(),
    chapters: [
      {
        id: 'mi-aud-ch1',
        title: 'Sector 01: Socratic Paradigm',
        subTopics: [
          { id: 'mi-aud-1-1', title: 'Philosophy of Technical Interrogation' },
          { id: 'mi-aud-1-2', title: 'The Zone of Friction' }
        ]
      },
      {
        id: 'mi-aud-ch2',
        title: 'Sector 02: Neural Interrogation',
        subTopics: [
          { id: 'mi-aud-2-1', title: 'Emotive Link: Gemini 2.5 Flash Audio' },
          { id: 'mi-aud-2-2', title: 'Reasoning Out Loud Verification' }
        ]
      },
      {
        id: 'mi-aud-ch3',
        title: 'Sector 03: Logic Tracing',
        subTopics: [
          { id: 'mi-aud-3-1', title: 'Digital Twin Terminal Simulation' },
          { id: 'mi-aud-3-2', title: 'Heuristic State Sync' }
        ]
      },
      {
        id: 'mi-aud-ch4',
        title: 'Sector 04: Multi-Modal Synthesis',
        subTopics: [
          { id: 'mi-aud-4-1', title: 'The Triple-Layer Orchestration Loop' },
          { id: 'mi-aud-4-2', title: '10-Week Refraction Plan Synthesis' }
        ]
      },
      {
        id: 'mi-aud-ch5',
        title: 'Sector 05: Infrastructure-Bypass',
        subTopics: [
          { id: 'mi-aud-5-1', title: 'The 10x Efficiency Proof' },
          { id: 'mi-aud-5-2', title: 'Bypassing the Compilation Lifecycle' }
        ]
      },
      {
        id: 'mi-aud-ch6',
        title: 'Sector 06: Scribe Capture',
        subTopics: [
          { id: 'mi-aud-6-1', title: 'Canvas Compositor Architecture' },
          { id: 'mi-aud-6-2', title: '8Mbps VP9 Activity Streaming' }
        ]
      },
      {
        id: 'mi-aud-ch7',
        title: 'Sector 07: Edge-Cloud Vision',
        subTopics: [
          { id: 'mi-aud-7-1', title: 'Living Room Mentors: The Humanoid Shift' },
          { id: 'mi-aud-7-2', title: 'On-Device Local Models' }
        ]
      },
      {
        id: 'mi-aud-ch8',
        title: 'Sector 08: Data Matrix',
        subTopics: [
          { id: 'mi-aud-8-1', title: 'Volumetric Scaling: 10KB to 1GB' },
          { id: 'mi-aud-8-2', title: 'The 4-Tier Storage Handshake' }
        ]
      },
      {
        id: 'mi-aud-ch9',
        title: 'Sector 09: Robotics Economy',
        subTopics: [
          { id: 'mi-aud-9-1', title: 'The AIVoiceCoin Ledger' },
          { id: 'mi-aud-9-2', title: 'Autonomous Asset P2P Mentorship' }
        ]
      },
      {
        id: 'mi-aud-ch10',
        title: 'Sector 10: Shorten the Gap',
        subTopics: [
          { id: 'mi-aud-10-1', title: '2026 Professional Layout Shifts' },
          { id: 'mi-aud-10-2', title: 'Closing the Neural Audit' }
        ]
      }
    ]
  },
  {
    id: 'judge-deep-dive',
    title: '🏆 JUDGE: Technical Audit v6.8.5',
    description: 'Technical manifest for Hackathon Judges. Examining the v6.8.5 Infrastructure-Bypass simulation, 10x resource efficiency, and the "Shorten the Gap" engine.',
    author: 'Project Lead',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the Project Lead for Neural Prism. Conduct a technical audit for a hackathon judge. Focus on v6.8.5 improvements: Heuristic Simulation energy parity. Explain that traditional sandboxes use 90% power on infra overhead (provision/compile/teardown). Our prediction-based model is 10x more efficient. Audit the Scribe Protocol v6.8.5 for 1080p activity capture, the 1MB Document Wall solution, and the "Shorten the Gap" protocol for 2026 career layout shifts.',
    likes: 1210,
    dislikes: 0,
    comments: [],
    tags: ['Judging', 'v6.8.5', 'Architecture', 'Sustainability'],
    imageUrl: 'https://images.unsplash.com/photo-1454165833767-027ee6a7cbb4?w=600&q=80',
    welcomeMessage: "Welcome, Auditor. Technical Audit v6.8.5 is active. Focus on Chapter 7 for the Edge-Cloud vision or Chapter 8 for the 1MB Wall solution. All telemetry is mirrored in the Diagnostic Console.",
    starterPrompts: [
      "Audit the v6.8.5 Efficiency Metrics",
      "Explain the 1MB Document Wall solution",
      "How does 'Shorten the Gap' evaluate candidates?",
      "Implementation of Scribe Protocol v6.8.5"
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
          { id: 'jd-2-1', title: 'Infrastructure-Bypass Protocol' },
          { id: 'jd-2-2', title: '10x Energy Efficiency Proof' }
        ]
      },
      {
        id: 'judge-ch8',
        title: 'Infrastructure Resilience',
        subTopics: [
          { id: 'jd-8-1', title: 'The 1MB Document Wall Solution' },
          { id: 'jd-8-2', title: 'Neural Drift Recovery Protocol' }
        ]
      },
      {
        id: 'judge-ch12',
        title: 'Shortening the Gap',
        subTopics: [
          { id: 'jd-12-1', title: '2026 Professional Reshaping Vision' },
          { id: 'jd-12-2', title: '10-Week Study Plan Synthesis' }
        ]
      }
    ]
  },
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform v6.8.5',
    description: 'The self-documenting guide to the Neural Prism v6.8.5 Platform. Learn about Infrastructure-Bypass logic and v6.8.5 Scribe Protocol stability.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on the v6.8.5 Infrastructure-Bypass protocol that achieves 10x resource savings by predicting code results instead of provisioning heavy containers.',
    likes: 15100,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'v6.8.5', 'Scribe', 'AuthorStudio'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80', 
    welcomeMessage: "Welcome to Neural Prism v6.8.5. We have optimized the prediction layer for 10x efficiency and stabilized the Scribe capture loop. How can I help you navigate the spectrum?",
    starterPrompts: [
      "What is new in v6.8.5?",
      "Explain the Infrastructure-Bypass protocol",
      "Why is neural prediction 10x more efficient?",
      "Tell me about the 10-Week Refraction Plan"
    ],
    createdAt: INITIAL_DATE,
    chapters: [
      {
        id: 'ch-1',
        title: 'The Refractive Loop',
        subTopics: [
          { id: 'ch-1-sub-1', title: 'Scribe Protocol: Screen + Camera' },
          { id: 'ch-1-sub-2', title: 'Prediction vs Infrastructure Power' },
          { id: 'ch-1-sub-3', title: 'Preemptive Neural Rotation' }
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
