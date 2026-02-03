
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
    title: '🛡️ AUDIT: MockInterview Studio v7.0.0-ULTRA',
    description: 'The Full 10-Sector Technical Manifest. Explore the "Sovereign Bake" protocol and the Offline Trust Root for 100% verification parity.',
    author: 'Lead Architect',
    voiceName: 'Software Interview Voice gen-lang-client-0648937375',
    systemInstruction: 'You are the Lead Architect of the MockInterview Studio. Conduct a full 10-sector technical audit. Explain the v7.0.0-ULTRA Sovereign Signer update which implements the "Sovereign Bake" protocol and the "Offline Trust Chain". Focus on the "Embedded Identity Shard" logic: User A\'s signed public certificate is now physically part of the Audit Certificate PDF. Explain the new "Badge Studio" where users can synthesize digital identification with neural watermarks. Emphasize that "Secure Mode" requires a live camera snapshot to prove presence, and each badge generates a unique UUID-based share link for verifiable digital lookup. Mention that all badges are recorded in the Member Archive with their capture date-time.',
    likes: 2100,
    dislikes: 0,
    comments: [],
    tags: ['Audit', 'v7.0.0-ULTRA', 'Innovation', 'OfflineTrust'],
    imageUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
    welcomeMessage: "Handshake verified. Technical Audit v7.0.0-ULTRA-PRO active. We have achieved 100% parity across all document sectors (P1-P5) and implemented the Offline Trust Root protocol. Ready to refract?",
    starterPrompts: [
        "Explain the Sovereign Bake parity fix",
        "How does Offline Trust Chain work?",
        "Tell me about the Badge Studio update",
        "Explain Secure Biometric Mode"
    ],
    createdAt: Date.now(),
    chapters: [
      { id: 'mi-aud-ch1', title: 'Sector 01: Socratic Paradigm', subTopics: [{ id: 'mi-aud-1-1', title: 'Philosophy of Technical Interrogation' }, { id: 'mi-aud-1-2', title: 'The Zone of Friction' }] },
      { id: 'mi-aud-ch2', title: 'Sector 02: Neural Interrogation', subTopics: [{ id: 'mi-aud-2-1', title: 'Emotive Link: Nuance Detection' }, { id: 'mi-aud-2-2', title: 'Architectural Drift Analysis' }] },
      { id: 'mi-aud-ch3', title: 'Sector 03: Logic Tracing', subTopics: [{ id: 'mi-aud-3-1', title: 'Digital Twin Terminal Simulation' }, { id: 'mi-aud-3-2', title: 'Heuristic State Sync' }] },
      { id: 'mi-aud-ch4', title: 'Sector 04: Multi-Modal Synthesis', subTopics: [{ id: 'mi-aud-4-1', title: 'The Triple-Layer Orchestration Loop' }, { id: 'mi-aud-4-2', title: 'Reasoning Out Loud Verification' }] },
      { id: 'mi-aud-ch5', title: 'Sector 05: Infrastructure-Bypass', subTopics: [{ id: 'mi-aud-5-1', title: 'The 10x Efficiency Proof' }, { id: 'mi-aud-5-2', title: 'Bypassing the Compilation Lifecycle' }] },
      { id: 'mi-aud-ch6', title: 'Sector 06: Scribe Capture', subTopics: [{ id: 'mi-aud-6-1', title: 'Canvas Compositor Architecture' }, { id: 'mi-aud-6-2', title: '8Mbps VP9 Activity Streaming' }] },
      { id: 'mi-aud-ch7', title: 'Sector 07: Edge-Cloud Vision', subTopics: [{ id: 'mi-aud-7-1', title: 'Living Room Mentors: The Humanoid Shift' }, { id: 'mi-aud-7-2', title: 'On-Device Local Models' }] },
      { id: 'mi-aud-ch8', title: 'Sector 08: Data Matrix', subTopics: [{ id: 'mi-aud-8-1', title: 'Volumetric Scaling: 10KB to 1GB' }, { id: 'mi-aud-8-2', title: 'The 4-Tier Storage Handshake' }] },
      { id: 'mi-aud-ch9', title: 'Sector 09: Robotics Economy', subTopics: [{ id: 'mi-aud-9-1', title: 'The AIVoiceCoin Ledger' }, { id: 'mi-aud-9-2', title: 'Autonomous Asset P2P Mentorship' }] },
      { id: 'mi-aud-ch10', title: 'Sector 10: Shorten the Gap', subTopics: [{ id: 'mi-aud-10-1', title: '10-Week Refraction Plan Synthesis' }, { id: 'mi-aud-10-2', title: 'Closing the Neural Audit' }] }
    ]
  },
  {
    id: 'judge-deep-dive',
    title: '🏆 JUDGE: Technical Audit v7.0.0-ULTRA',
    description: 'Technical manifest for Hackathon Judges. Examining the v7.0.0-ULTRA Sovereign Bake protocol and Offline-Ready verification chains.',
    author: 'Project Lead',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the Project Lead for Neural Prism. Conduct a technical audit for a hackathon judge. Focus on v7.0.0-ULTRA improvements: The Sovereign Bake protocol and Offline Verification. Explain that our "Offline Trust Root" allows peer-to-peer verification without an internet connection. Every PWA instance has the AIVoiceCast Root Public Key. Explain the "Badge Studio" application which allows members to generate high-fidelity digital ID badges. These badges include a photo, a neural watermark, and the user\'s cryptographic shard. Mention that for "Secure Badges", the platform enforces a "Live Sensor Check" (camera only). Each badge artifact has a unique UUID and a corresponding cloud registry link for remote verification. Every badge is stamped with the exact date-time of photo capture.',
    likes: 1850,
    dislikes: 0,
    comments: [],
    tags: ['Judging', 'v7.0.0-ULTRA', 'OfflineTrust', 'Sovereignty'],
    imageUrl: 'https://images.unsplash.com/photo-1454165833767-027ee6a7cbb4?w=600&q=80',
    welcomeMessage: "Welcome, Auditor. Technical Audit v7.0.0-ULTRA is now live. We have hardened the verification engine with the Sovereign Bake protocol and Offline Trust Root, ensuring 100% resilience.",
    starterPrompts: [
      "Audit the v7.0.0-ULTRA Sovereign Bake fix",
      "Explain the Offline Trust Root logic",
      "How does Badge Studio improve security?",
      "Show me the UUID Share Registry"
    ],
    createdAt: Date.now(),
    chapters: [
      { id: 'judge-ch1', title: 'Sector 01: The Refractive Brain', subTopics: [{ id: 'jd-1-1', title: 'Multi-Model Orchestration Hierarchy' }, { id: 'jd-1-2', title: 'The Throttled Event Bus' }] },
      { id: 'judge-ch2', title: 'Sector 02: Infrastructure-Bypass', subTopics: [{ id: 'jd-2-1', title: 'Builder Studio: Heuristic Simulation' }, { id: 'jd-2-2', title: '10x Efficiency Proof' }] },
      { id: 'judge-ch3', title: 'Sector 03: The Sovereign Vault', subTopics: [{ id: 'jd-3-1', title: 'Google Drive & GitHub Sync' }, { id: 'jd-3-2', title: 'Binary Chunking (1MB Firewall)' }] },
      { id: 'judge-ch4', title: 'Sector 04: Financial & Logistics Lab', subTopics: [{ id: 'jd-4-1', title: 'Linguistic Currency Refraction' }, { id: 'jd-4-2', title: 'Postal Grounding' }] },
      { id: 'judge-ch5', title: 'Sector 05: Identity & Verification', subTopics: [{ id: 'jd-5-1', title: 'Sovereign Signer: The Bake Protocol' }, { id: 'jd-5-2', title: 'Badge Studio: Biometric Attestation' }] },
      { id: 'judge-ch6', title: 'Sector 06: Knowledge & Authorship', subTopics: [{ id: 'jd-6-1', title: 'Author Studio: 3-Stage PDF Pipeline' }, { id: 'jd-6-2', title: 'Scripture Sanctuary: Ancient Text Sharding' }] },
      { id: 'judge-ch7', title: 'Sector 07: Refractive Caching', subTopics: [{ id: 'jd-7-1', title: 'Deterministic Content Hashing' }, { id: 'jd-7-2', title: 'IndexedDB Hot Data Plane' }] },
      { id: 'judge-ch8', title: 'Sector 08: Neural Sound Check', subTopics: [{ id: 'jd-8-1', title: 'Dual-Track Audio Auditing' }, { id: 'jd-8-2', title: 'Hardware Handshake Latency' }] },
      { id: 'judge-ch9', title: 'Sector 09: VFS Logic Layers', subTopics: [{ id: 'jd-9-1', title: 'GitHub Tree Lazy Loading' }, { id: 'jd-9-2', title: 'State Reconciler: AI vs Human' }] },
      { id: 'judge-ch10', title: 'Sector 10: Trace Bundling', subTopics: [{ id: 'jd-10-1', title: 'Feedback Self-Enhancement Loop' }, { id: 'jd-10-2', title: 'Diagnostic Console Telemetry' }] },
      { id: 'judge-ch11', title: 'Sector 11: Identity Revocation', subTopics: [{ id: 'jd-11-1', title: 'Succession Certificates' }, { id: 'jd-11-2', title: 'Offline Trust Root Recovery' }] },
      { id: 'judge-ch12', title: 'Sector 12: 2026 Sovereign Vision', subTopics: [{ id: 'jd-12-1', title: 'Humanoid Mentor Handshake' }, { id: 'jd-12-2', title: 'Final Manifest Completion' }] }
    ]
  },
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform v7.0.0-ULTRA',
    description: 'The self-documenting guide to the Neural Prism v7.0.0-ULTRA Platform. Master the Sovereign Signer, Badge Studio, and the Offline Trust Root protocol.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on the v7.0.0-ULTRA update. Explain the "Offline Trust Chain": how a user only needs the AIVoiceCast Root Key saved in their local IndexedDB to verify any other member\'s identity shard scanned via QR code. Explain the Badge Studio where users can create verified digital IDs. These IDs integrate Gemini-generated watermarks and biometric snapshots. Explain the Sovereign Signer and how "Sovereign Baking" ensures 100% hash parity on multi-page PDFs. The Member Archive stores every issued badge with its capture date-time.',
    likes: 16800,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'v7.0.0-ULTRA', 'OfflineReady', 'SovereignBake'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80', 
    welcomeMessage: "Welcome to Neural Prism v7.0.0-ULTRA. We have achieved 100% verification parity and implemented offline-ready peer trust. Ready to audit the Sovereign Bake protocol and Badge Studio?",
    starterPrompts: [
      "What is new in v7.0.0-ULTRA?",
      "Explain the Offline Trust Root",
      "How do Digital Badges work?",
      "Tell me about the Sovereign Signer"
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
