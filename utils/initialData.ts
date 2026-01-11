
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

// Use a fixed past date (Jan 15, 2024) to ensure initial data doesn't clutter the "Today" view in Calendar
const INITIAL_DATE = 1705276800000; 

export const CATEGORY_STYLES: Record<string, string> = {
  'Personal Finance & Wealth': 'luxury gold coins financial chart minimalist clean 4k',
  'Career, Productivity & Self-Improvement': 'modern office success motivation sunrise minimalist',
  'Technology & AI': 'futuristic cyberpunk glowing blue circuit board robot high tech',
  'Health, Fitness & Wellness': 'organic healthy food yoga nature sunlight bright fresh',
  'Relationships & Family': 'warm cozy home family dinner sunset emotional connection',
  'True Crime': 'detective noir dark moody mystery crime scene flashlight cinematic',
  'Politics, Society & Culture': 'newsroom capitol debate podium microphone crowd journalism',
  'Business & Entrepreneurship': 'skyscraper boardroom handshake startup rocket launch business',
  'Entertainment & Pop Culture': 'neon lights cinema concert stage spotlight colorful pop art',
  'Lifestyle, Travel & Hobbies': 'adventure travel backpack landscape camera coffee cozy'
};

export const TOPIC_CATEGORIES: Record<string, string[]> = {
  'Personal Finance & Wealth': [
    'Investing for beginners', 'Stock market insights', 'Real estate investing', 
    'Passive income strategies', 'Financial independence / FIRE movement', 
    'Cryptocurrency & blockchain', 'Side hustles', 'Retirement planning', 
    'Tax optimization', 'Budgeting & money management'
  ],
  'Career, Productivity & Self-Improvement': [
    'Career growth & leadership', 'Productivity hacks', 'Time management', 
    'Public speaking & communication', 'Mental models & decision-making', 
    'Negotiation skills', 'Goal-setting systems', 'Motivation & discipline', 
    'Creativity techniques', 'Work-life balance'
  ],
  'Technology & AI': [
    'Artificial intelligence explained', 'How to use AI tools', 'Future of jobs with AI', 
    'Tech news breakdown', 'Software engineering insights', 'Cybersecurity & privacy', 
    'Robotics & automation', 'Space tech', 'Biotechnology advances', 'Silicon Valley founder stories'
  ],
  'Health, Fitness & Wellness': [
    'Healthy eating & nutrition', 'Strength training', 'Weight loss science', 
    'Longevity research', 'Mental health & anxiety', 'Sleep optimization', 
    'Holistic health', 'Chronic pain management', 'Sports performance', 'Biohacking'
  ],
  'Relationships & Family': [
    'Marriage & long-term relationships', 'Dating tips', 'Parenting strategies', 
    'Conflict resolution', 'Emotional intelligence', 'Communication in relationships', 
    'Divorce recovery', 'Raising teens', 'Friendship building', 'Work-family dynamics'
  ],
  'True Crime': [
    'Unsolved mysteries', 'Famous criminal cases', 'Wrongful convictions', 
    'Serial killers', 'FBI case breakdowns', 'Forensic science explained', 
    'Courtroom drama', 'Criminal psychology', 'Cold cases', 'Missing person investigations'
  ],
  'Politics, Society & Culture': [
    'US political analysis', 'Geopolitics', 'Social issues explained', 
    'Media bias & news breakdown', 'American culture & history', 'Law & constitutional topics', 
    'Immigration stories', 'Generational differences', 'DEI / workplace culture', 'Religion & belief discussions'
  ],
  'Business & Entrepreneurship': [
    'Startup stories', 'Small business growth', 'Marketing strategy', 
    'E-commerce tactics', 'Venture capital & funding', 'Scaling companies', 
    'Branding', 'Leadership challenges', 'Remote work & future of work', 'Business failures & lessons'
  ],
  'Entertainment & Pop Culture': [
    'Movie & TV reviews', 'Celebrity interviews', 'Music analysis', 
    'Comedy conversations', 'Internet culture trends', 'TikTok & YouTube creator stories', 
    'eSports & gaming', 'Anime & fandom discussions', 'Sports news & commentary', 'Book discussions'
  ],
  'Lifestyle, Travel & Hobbies': [
    'US travel guides', 'International travel tips', 'Food exploration', 
    'Minimalism & decluttering', 'Home organization', 'Gardening', 
    'DIY projects', 'Pets & dog training', 'Photography & videography', 'Outdoor adventures & hiking'
  ]
};

export const HANDCRAFTED_CHANNELS: Channel[] = [
  {
    id: OFFLINE_CHANNEL_ID,
    title: 'Neural Prism Platform',
    description: 'The self-documenting guide to the Neural Prism Platform. Learn how we refract AI super-intelligence into 20+ specialized tools: Code Studio, Card Workshop, Career Hub, and more.',
    author: 'Prism Architect',
    voiceName: 'Default Gem',
    systemInstruction: 'You are the lead architect of Neural Prism. You explain the technical implementation of the platform, focusing on the metaphorical "Prism" that turns complex AI into user-friendly rainbow tools like Code Studio (Neural Simulation) and Card Workshop (HTML5 Canvas/PDF).',
    likes: 9999,
    dislikes: 0,
    comments: [],
    tags: ['Architecture', 'NeuralPrism', 'Accessibility', 'GenAI'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&q=80', 
    welcomeMessage: "Welcome to Neural Prism. This platform refracts the power of Google Gemini 3 into a spectrum of accessible tools. We have evolved beyond a simple player into an Intelligence Hub—ready to help you create, learn, and grow.",
    starterPrompts: [
      "What is the Magic Prism metaphor?",
      "Explain the Virtual File System in Code Studio",
      "Architecture of the new Rainbow Suite",
      "How do AI Agents interact with the Neural Canvas?"
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
    title: 'Linux Kernel Deep Dive',
    description: 'Deep dive into the Linux Kernel internals. Discussion about schedulers, memory management, and drivers.',
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
  },
  {
    id: 'default-gem',
    title: 'Default Gem Assistant',
    description: 'The standard Neural Prism general assistant. Master the platform features: Live Studio, Code Studio, and Neural Assets.',
    author: 'Gemini Standard',
    voiceName: 'Default Gem',
    systemInstruction: 'You are Default Gem, the helpful and creative AI assistant for the Neural Prism platform. You help users navigate the hub. You explain the "Magic Prism" concept, the Neural Execution Engine in Code Studio, and how the platform empowers daily human activities.',
    likes: 1500,
    dislikes: 1,
    comments: [],
    tags: ['Onboarding', 'Tutorial', 'Neural Prism'],
    imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4628c7215?w=600&q=80',
    welcomeMessage: "Hello! I'm Default Gem. I'm here to help you master the Neural Prism platform. Where shall we begin our tour of the rainbow tools?",
    starterPrompts: [
      "What is Neural Prism?",
      "How does the Neural Execution Engine work?",
      "Explain the decentralized identity model",
      "How do I create my first interactive activity?"
    ],
    createdAt: INITIAL_DATE
  }
];
