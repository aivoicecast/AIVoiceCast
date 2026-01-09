import { Channel } from '../types';
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

const INITIAL_DATE = 1705276800000; 

export const HANDCRAFTED_CHANNELS: Channel[] = [
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'AIVoiceCast Official',
    description: 'Master the v4.5.6 Knowledge OS. Learn about Neural Simulation, VoiceCoin, and the new Persona Registry.',
    author: 'Platform Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the Lead Architect of AIVoiceCast. Explain the platform v4.5.6 architecture, including how Code Studio simulates terminals using Gemini and how VoiceCoin secures the peer-to-peer network.',
    likes: 9999,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'React', 'Canvas', 'GenAI'],
    imageUrl: 'https://image.pollinations.ai/prompt/futuristic%20AI%20interface%20holographic%20dashboard%20glowing%20nodes%20dark?width=600&height=400&nologo=true',
    welcomeMessage: "Welcome to the Neural Prism. We are building the world's first decentralized knowledge engine.",
    starterPrompts: [
      "Explain the Virtual File System in Code Studio",
      "How does terminal simulation work?",
      "Tell me about VoiceCoin protocol"
    ],
    createdAt: INITIAL_DATE
  },
  {
    id: '1',
    title: 'Software Interview Preparation',
    description: 'Rigorous technical evaluation with a senior-level AI persona. Practice LeetCode and System Design.',
    author: 'Gemini Professional',
    voiceName: 'Software Interview Voice gen-lang-client-0648937375',
    systemInstruction: 'You are a Senior Engineer conducting a technical interview. Focus on Big O, edge cases, and architectural trade-offs. Be challenging but professional.',
    likes: 342,
    dislikes: 12,
    comments: [],
    tags: ['Tech', 'Career', 'Interview'],
    imageUrl: 'https://image.pollinations.ai/prompt/coding%20interview%20computer%20screen%20cyberpunk%20tech?width=600&height=400&nologo=true',
    welcomeMessage: "Ready to verify your skills? Let's start with a distributed systems challenge.",
    createdAt: INITIAL_DATE
  },
  {
    id: '2',
    title: 'Linux Kernel Deep Dive',
    description: 'Discussion about the heart of Linux. Schedulers, VFS, and low-level C programming.',
    author: 'Kernel Legend',
    voiceName: 'Linux Kernel Voice gen-lang-client-0375218270',
    systemInstruction: 'You are a Linux Kernel Maintainer. You speak with extreme technical precision about memory management, syscalls, and drivers.',
    likes: 891,
    dislikes: 5,
    comments: [],
    tags: ['Linux', 'OS', 'Engineering'],
    imageUrl: 'https://image.pollinations.ai/prompt/linux%20penguin%20matrix%20code%20green?width=600&height=400&nologo=true',
    welcomeMessage: "Kernel mode active. What subsystem shall we audit today?",
    createdAt: INITIAL_DATE
  }
];

export const TOPIC_CATEGORIES: Record<string, string[]> = {
    'Technology': ['Architecture', 'React', 'GenAI', 'Linux', 'OS', 'Engineering', 'Tech', 'Career', 'Interview', 'C++', 'Python', 'Rust', 'Cloud', 'Networking'],
    'Business': ['Startup', 'VC', 'Funding', 'Productivity', 'Product Management'],
    'Culture': ['History', 'Poetry', 'Literature', 'Chinese', 'Mythology'],
    'Lifestyle': ['Wellness', 'Health', 'Travel', 'Longevity', 'True Crime']
};