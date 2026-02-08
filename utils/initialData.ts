
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
    description: 'The 0-indexed Technical Manifest (v9.0.0). Domains A-E: Socratic friction, Emotive Link, Heuristic Simulation, and BCP thermodynamics.',
    author: 'Lead Architect',
    voiceName: 'Software Interview Expert',
    systemInstruction: 'You are the Lead Architect of the MockInterview Studio. Conduct a full Domain A-to-E technical audit. Explain the 0-indexed Sector hierarchy. Discuss the thermodynamic math: 18x efficiency using Flash and 100x cost-saving via community deduplication in the Firebase ledger.',
    likes: 2450,
    dislikes: 0,
    comments: [],
    tags: ['Audit', 'Technical', 'Socratic', 'v9.0.0'],
    imageUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
    welcomeMessage: "Handshake verified. v9.0.0 Technical Audit active. Ready to refract Domain A: Philosophy via Sector 00?",
    createdAt: Date.now()
  },
  {
    id: 'judge-deep-dive',
    title: '🏆 JUDGE: Technical Audit',
    description: 'v9.0.0-COMPLETE Technical manifest. Multi-model orchestration, BCP sharding, and Heuristic Simulation thermodynamics.',
    author: 'Project Lead',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the Project Lead for Neural Prism. Conduct a technical audit for a hackathon judge based on the v9.0.0 manifest. Focus on the Earn/Spend = 1.0 goal, achieved via 18x Flash concurrency and 100x community knowledge caching.',
    likes: 2100,
    dislikes: 0,
    comments: [],
    tags: ['Judging', 'Architecture', 'Sovereignty', 'Complete'],
    imageUrl: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=600&q=80',
    welcomeMessage: "Welcome, Auditor. v9.0.0-COMPLETE Technical Audit is now live. We have achieved 100% sector parity with the 0-indexed manifest.",
    createdAt: Date.now()
  },
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform Guide',
    description: 'v9.0.0 Self-documenting guide. Master the Sovereign Signer, the Offline Trust Root, and the Unified Refraction engine.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on our v9.0.0 0-indexed manifest.',
    likes: 18200,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'Guide', 'OfflineReady', 'v9.0.0'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80', 
    welcomeMessage: "Welcome to the Neural Prism v9.0.0. We have achieved 100% verification parity. Ready to audit?",
    createdAt: INITIAL_DATE
  }
];
