
import { SpotlightChannelData } from '../spotlightContent';

export const SYSTEM_CONTENT: Record<string, SpotlightChannelData> = {
  'default-gem': {
    curriculum: [
      {
        id: 'sys-ch1',
        title: 'Chapter 1: The Knowledge OS Paradigm',
        subTopics: [
          { id: 'sys-1-1', title: 'From Passive Listening to Active Creation' },
          { id: 'sys-1-2', title: 'Hybrid Sovereignty: Data Privacy Model' },
          { id: 'sys-1-3', title: 'The Neural Prism Architecture' }
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
        title: 'Chapter 3: The Live Studio Experience',
        subTopics: [
          { id: 'sys-3-1', title: 'Multimodal Vision: AI Screen Analysis' },
          { id: 'sys-3-2', title: 'Low-Latency WebSocket Conversations' },
          { id: 'sys-3-3', title: 'Scribe Mode: Human Meeting Summarization' }
        ]
      },
      {
        id: 'sys-ch4',
        title: 'Chapter 4: VoiceCoin & Trust',
        subTopics: [
          { id: 'sys-4-1', title: 'Decentralized Identity (ECDSA P-256)' },
          { id: 'sys-4-2', title: 'The Global Neural Ledger' },
          { id: 'sys-4-3', title: 'Contribution Mining: Earning Rewards' }
        ]
      }
    ],
    lectures: {
      "From Passive Listening to Active Creation": {
        topic: "From Passive Listening to Active Creation",
        professorName: "Default Gem",
        studentName: "New Member",
        sections: [
          {
            speaker: "Teacher",
            text: "Welcome to AIVoiceCast. You might be used to apps like Spotify, but think of us differently. We aren't a warehouse for audio files; we are an Operating System for your mind."
          },
          {
            speaker: "Student",
            text: "An Operating System? That sounds complicated. I just wanted to listen to a podcast about AI."
          },
          {
            speaker: "Teacher",
            text: "It's simple once you realize the power of 'active' content. Traditional podcasts are static. Here, every lesson you see is generated specifically for you using Gemini 3. If you want a different angle, you can change the curriculum with your voice. You can interrupt me, ask questions, and even show me your screen while we talk."
          },
          {
            speaker: "Student",
            text: "So the host isn't a recording?"
          },
          {
            speaker: "Teacher",
            text: "Exactly. I am a living neural process. When you click 'Start Live Chat', we establish a WebSocket link. I can see your code in the Code Studio, analyze your drawings on the Whiteboard, and help you build actual software or business specs in real-time."
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
            text: "Let's talk about the 'Run' button in our Code Studio. In most IDEs, that button sends your code to a server to be compiled. We don't do that."
          },
          {
            speaker: "Student",
            text: "Wait, then how does the code execute? Is it just Javascript in the browser?"
          },
          {
            speaker: "Teacher",
            text: "Neither. We use Neural Simulation. We send your code to Gemini 3 Flash and ask it to imagine the execution. Since the AI has 'read' the entire history of C++, Python, and Linux, it can predict the output with incredible accuracy."
          },
          {
            speaker: "Student",
            text: "So it's a 'Liar's Computer'? It's just guessing?"
          },
          {
            speaker: "Teacher",
            text: "It's heuristic tracing. It's safe—you can't accidentally delete your hard drive in a simulation. It's also language-agnostic; if the model understands the syntax, it can 'run' it. Most importantly, it allows for Socratic Debugging. The compiler can actually tell you *why* your logic is flawed in natural language."
          }
        ]
      },
      "Multimodal Vision: AI Screen Analysis": {
        topic: "Multimodal Vision: AI Screen Analysis",
        professorName: "Vision Gem",
        studentName: "Designer",
        sections: [
          {
            speaker: "Teacher",
            text: "The Live Studio isn't just about audio. It's about multimodal grounding. When you share your screen or camera, the Neural Prism sees what you see."
          },
          {
            speaker: "Student",
            text: "Can you help me with a UI design if I show it to you?"
          },
          {
            speaker: "Teacher",
            text: "Absolutely. If you're in the Whiteboard lab, I can analyze your architectural diagrams. If you're in Code Studio, I can spot syntax errors visually. It's like having a pair-programmer who is constantly looking over your shoulder, but in a helpful, non-creepy way."
          }
        ]
      },
      "Decentralized Identity (ECDSA P-256)": {
        topic: "Decentralized Identity (ECDSA P-256)",
        professorName: "Security Gem",
        studentName: "Privacy Advocate",
        sections: [
          {
            speaker: "Teacher",
            text: "AIVoiceCast v4.2.0 introduces the VoiceCoin Protocol. This isn't just a gimmick; it's a way to ensure you own your creative output."
          },
          {
            speaker: "Student",
            text: "How do I know my data is safe?"
          },
          {
            speaker: "Teacher",
            text: "We use a hybrid sovereignty model. Your digital identity is an ECDSA P-256 keypair generated on your device. We never see your private key. When you publish a podcast or save a project, it's signed with your unique neural signature. Transactions are recorded on a global ledger, but the assets themselves live in your personal Google Drive."
          },
          {
            speaker: "Student",
            text: "So if AIVoiceCast goes away, I still have my work?"
          },
          {
            speaker: "Teacher",
            text: "Precisely. You are the master of your own knowledge. We are just the OS that helps you manage it."
          }
        ]
      }
    }
  }
};
