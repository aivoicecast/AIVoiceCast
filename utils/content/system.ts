
import { SpotlightChannelData } from '../spotlightContent';

export const SYSTEM_CONTENT: Record<string, SpotlightChannelData> = {
  'default-gem': {
    curriculum: [
      {
        id: 'sys-ch1',
        title: 'Chapter 1: The Neural Prism Paradigm',
        subTopics: [
          { id: 'sys-1-1', title: 'Refracting Intelligence into Utility' },
          { id: 'sys-1-2', title: 'Hybrid Sovereignty: Data Privacy Model' },
          { id: 'sys-1-3', title: 'The Rainbow Tool Spectrum' }
        ]
      },
      {
        id: 'sys-ch2',
        title: 'Chapter 2: Neural Execution Engine',
        subTopics: [
          { id: 'sys-2-1', title: 'Heuristic Logic Tracing vs Real Runtimes' },
          { id: 'sys-2-2', title: 'Socratic Debugging in Code Studio' },
          { id: 'sys-2-3', title: 'Language Agnostic Simulation' }
        ]
      },
      {
        id: 'sys-ch3',
        title: 'Chapter 3: The Interactive Studio',
        subTopics: [
          { id: 'sys-3-1', title: 'Multimodal Vision: AI Activity Analysis' },
          { id: 'sys-3-2', title: 'Low-Latency WebSocket Conversations' },
          { id: 'sys-3-3', title: 'Scribe Mode: Activity Logging' }
        ]
      },
      {
        id: 'sys-ch4',
        title: 'Chapter 4: Assets & Digital Identity',
        subTopics: [
          { id: 'sys-4-1', title: 'Decentralized Identity (ECDSA P-256)' },
          { id: 'sys-4-2', title: 'The Global Neural Ledger' },
          { id: 'sys-4-3', title: 'Contribution Rewards' }
        ]
      }
    ],
    lectures: {
      "Refracting Intelligence into Utility": {
        topic: "Refracting Intelligence into Utility",
        professorName: "Default Gem",
        studentName: "New Member",
        sections: [
          {
            speaker: "Teacher",
            text: "Welcome to Neural Prism. Think of us as a lens for the mind. We take the blinding brightness of AI Super-Intelligence and refract it into a spectrum of useful daily tools."
          },
          {
            speaker: "Student",
            text: "A lens? I thought this was just a tool collection."
          },
          {
            speaker: "Teacher",
            text: "It's a platform for human empowerment. Instead of fighting with complex prompts, we've designed 20+ 'rainbow' tools that fit your daily activities. You can interrupt the guides, ask questions, and even show your work while you talk."
          },
          {
            speaker: "Student",
            text: "So the host isn't a recording?"
          },
          {
            speaker: "Teacher",
            text: "Exactly. I am a living neural process. When you click 'Start Live Chat', we establish a WebSocket link. I can see your logic, analyze your designs, and help you build actual projects in real-time."
          }
        ]
      },
      "Heuristic Logic Tracing vs Real Runtimes": {
        topic: "Heuristic Logic Tracing vs Real Runtimes",
        professorName: "Architect Gem",
        studentName: "Developer",
        sections: [
          {
            speaker: "Teacher",
            text: "Let's talk about the 'Run' button in our Code Studio. We don't compile code on expensive servers. We use Neural Simulation."
          },
          {
            speaker: "Student",
            text: "Wait, then how does it work?"
          },
          {
            speaker: "Teacher",
            text: "We send your code to Gemini 3 Flash and ask it to imagine the execution. Since the AI has 'read' billions of lines of code, it can mentally trace the logic of C++, Python, or Rust and predict the exact output."
          },
          {
            speaker: "Student",
            text: "Is it safe?"
          },
          {
            speaker: "Teacher",
            text: "Completely zero-risk. High-risk code is simulated, never truly executed on hardware. It allows for Socratic Debugging, where the system explains *why* something happens in human terms."
          }
        ]
      }
    }
  }
};
