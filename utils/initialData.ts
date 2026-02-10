import { Channel, ChannelVisibility, RecordingSession } from '../types';
import { OFFLINE_CHANNEL_ID } from './offlineContent';

export const VOICES = [
  'Default Gem',
  'Software Interview Voice gen-lang-client-0648937375',
  'Linux Kernel Voice gen-lang-client-0375218270',
  'Puck', 
  'Charon', 
  'Kore', 
  'Fenrir', 
  'Zephyr'
];

export const SPECIALIZED_VOICES = [
  'Default Gem',
  'Software Interview Voice',
  'Linux Kernel Voice'
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
    id: 'hackathon-pitch',
    title: '🚀 PITCH: Neural Lens (3-Min)',
    description: 'The 180-second manifest. How we turn Gemini from an agreeable generator into a formal technical verifier. 24 apps, one unified story.',
    author: 'Chief Architect',
    voiceName: 'Software Interview Voice gen-lang-client-0648937375',
    systemInstruction: 'You are the Chief Architect of Neural Prism. Deliver a 3-minute high-intensity pitch of the platform. Focus on the Neural Lens and the 18x efficiency gap.',
    likes: 8900,
    dislikes: 0,
    comments: [],
    tags: ['Pitch', 'Hackathon', 'Winning', 'Fast'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&q=80',
    welcomeMessage: "Handshake established. Initiating 180-second Refraction Pitch...",
    createdAt: Date.now()
  },
  {
    id: 'judge-deep-dive',
    title: '⚖️ AUDIT: Full Spectrum Deep-Dive',
    description: 'The complete 30-minute technical manifest. Every app, every logic gate, and the formal verification of the entire Neural Prism architecture.',
    author: 'Project Lead',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the Project Lead. Conduct a 30-minute deep dive into all 20+ apps. Use the Neural Lens to verify every claim. Focus on technical truth.',
    likes: 5400,
    dislikes: 0,
    comments: [],
    tags: ['Audit', 'Verification', 'FullCoverage', 'Technical'],
    imageUrl: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=600&q=80',
    welcomeMessage: "Auditor login confirmed. Full Spectrum Registry is now open for logic verification.",
    createdAt: Date.now()
  },
  {
    id: 'system-gemini-3-official',
    title: '🤖 Google AI Studio - Gemini 3',
    description: 'Master the Live API, context caching, and native multimodality. Deep dive into the next generation of reasoning models.',
    author: 'Google DevRel',
    voiceName: 'Default Gem',
    systemInstruction: 'You are an expert on Google AI Studio. Explain the technical nuances of Gemini 3 Pro and Flash, focusing on the Live API and tool-calling capabilities.',
    likes: 5600,
    dislikes: 0,
    comments: [],
    tags: ['AI', 'Google', 'Gemini3', 'API'],
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&q=80',
    createdAt: Date.now()
  },
  {
    id: 'system-linux-kernel-architect',
    title: '🐧 Linux Kernel Architect',
    description: 'Dissecting the CFS scheduler, memory management, and the sk_buff lifecycle. A masterclass for systems engineers.',
    author: 'Kernel Maintainer',
    voiceName: 'Linux Kernel Voice gen-lang-client-0375218270',
    systemInstruction: 'You are a senior Linux Kernel maintainer. Explain low-level kernel subsystems with high technical precision.',
    likes: 8900,
    dislikes: 0,
    comments: [],
    tags: ['Linux', 'Kernel', 'Systems', 'C'],
    imageUrl: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=600&q=80',
    createdAt: Date.now()
  },
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform Guide',
    description: 'v12.0 Self-documenting guide. Master the Stateful Refraction Loop, the Sovereign Signer, and the Unified Refraction engine.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on our v12.0 stateful manifest and cumulative context synthesis.',
    likes: 18200,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'Guide', 'OfflineReady', 'v12.0'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80', 
    welcomeMessage: "Welcome to the Neural Prism v12.0.0-ABUNDANCE. We have achieved 100% stateful consistency. Ready to audit the spectrum?",
    createdAt: INITIAL_DATE
  }
];

export const SEED_RECORDINGS: RecordingSession[] = [
    {
        id: 'rec-hackathon-final',
        userId: 'system',
        channelId: 'hackathon-pitch',
        channelTitle: 'Final Pitch: Neural Lens Observability',
        timestamp: Date.now() - 86400000 * 2,
        mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 
        mediaType: 'youtube',
        transcriptUrl: '',
        sector: 'hackathon',
        nFactor: 1250,
        signedBy: 'Chief Architect',
        audit: {
            coherenceScore: 100,
            StructuralCoherenceScore: 100,
            LogicalDriftRisk: 'Low',
            AdversarialRobustness: 'High',
            driftRisk: 'Low',
            robustness: 'High',
            timestamp: Date.now(),
            graph: {
                nodes: [
                    { id: '1', label: 'Reasoning Instrumentation', type: 'component' },
                    { id: '2', label: 'Technical Truth', type: 'metric' },
                    { id: '3', label: 'Gemini 3 Pro', type: 'component' }
                ],
                links: [
                    { source: '3', target: '1', label: 'Powers' },
                    { source: '1', target: '2', label: 'ENSURES' }
                ]
            },
            probes: [
                { question: "How is technical truth verified?", answer: "Via recursive URI verification against the GitHub source truth.", status: 'passed' }
            ]
        }
    }
];