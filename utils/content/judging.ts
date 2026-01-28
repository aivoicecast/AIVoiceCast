
import { SpotlightChannelData } from '../spotlightContent';

export const JUDGING_CONTENT: Record<string, SpotlightChannelData> = {
  'judge-deep-dive': {
    curriculum: [
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
          { id: 'jd-2-2', title: 'Battling Neural Drift & Snapshot Restores' }
        ]
      },
      {
        id: 'judge-ch3',
        title: 'Chapter 3: Finance Lab (Asset Synthesis)',
        subTopics: [
          { id: 'jd-3-1', title: 'Pixel-Perfect Document Rasterization' },
          { id: 'jd-3-2', title: 'Neural Security Seals & Watermarking' }
        ]
      },
      {
        id: 'judge-ch4',
        title: 'Chapter 4: Logistics Lab (Neural Ingest)',
        subTopics: [
          { id: 'jd-4-1', title: 'Address Refraction & Structure Extraction' },
          { id: 'jd-4-2', title: 'Thermal Print Optimization (4x6)' }
        ]
      },
      {
        id: 'judge-ch5',
        title: 'Chapter 5: Builder Studio (Heuristic Simulation)',
        subTopics: [
          { id: 'jd-5-1', title: 'Infrastructure-less Code Execution' },
          { id: 'jd-5-2', title: 'Gemini 3 Flash as a Digital Twin' }
        ]
      },
      {
        id: 'judge-ch6',
        title: 'Chapter 6: Career Hub (Multimodal Eval)',
        subTopics: [
          { id: 'jd-6-1', title: 'Technical Interrogation Protocols' },
          { id: 'jd-6-2', title: 'Socratic Feedback & Scoring Logic' }
        ]
      },
      {
        id: 'judge-ch7',
        title: 'Chapter 7: Scripture Sanctuary (Sacred Data)',
        subTopics: [
          { id: 'jd-7-1', title: 'Bilingual Verse-by-Verse Synthesis' },
          { id: 'jd-7-2', title: 'Neural Audio Archiving (Puck & Kore)' }
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
        id: 'judge-ch9',
        title: 'Chapter 9: The Global Ledger (VoiceCoin)',
        subTopics: [
          { id: 'jd-9-1', title: 'ECDSA Signed Digital Receipts' },
          { id: 'jd-9-2', title: 'Escrow & Claim Verification Flow' }
        ]
      },
      {
        id: 'judge-ch10',
        title: 'Chapter 10: Observability (Diagnostic Matrix)',
        subTopics: [
          { id: 'jd-10-1', title: 'Trace Bundling for Feedback loops' },
          { id: 'jd-10-2', title: 'Real-time Neural Handshake Telemetry' }
        ]
      },
      {
        id: 'judge-ch11',
        title: 'Chapter 11: Future (Self-Evolution Loop)',
        subTopics: [
          { id: 'jd-11-1', title: 'Dynamic Reconfiguration for Discovery' },
          { id: 'jd-11-2', title: 'Autonomous Refactoring Roadmap' }
        ]
      }
    ],
    lectures: {
      "Multi-Model Orchestration Pipeline": {
        topic: "Multi-Model Orchestration Pipeline",
        professorName: "Architect Gem",
        studentName: "Hackathon Judge",
        sections: [
          { speaker: "Teacher", text: "Welcome to the core of Neural Prism. We don't just use one model; we orchestrate an entire fleet. We use Gemini 3 Pro for complex logic and Gemini 3 Flash for high-speed simulation." },
          { speaker: "Student", text: "How do you handle the latency of switching between them?" },
          { speaker: "Teacher", text: "We use a 'Context Injection' pattern. Every time a tool starts, we bundle the current environment—code, documents, or logs—directly into the prompt. This ensures the AI always has a perfect 20/20 vision of your workspace without needing a separate backend state." }
        ]
      },
      "Infrastructure-less Code Execution": {
        topic: "Infrastructure-less Code Execution",
        professorName: "Engineering Lead",
        studentName: "Google Judge",
        sections: [
          { speaker: "Teacher", text: "Traditional IDEs are expensive. They need Docker containers and server runtimes. Our innovation is 'Heuristic Simulation'." },
          { speaker: "Student", text: "You mean you don't actually compile the code?" },
          { speaker: "Teacher", text: "Exactly. We treat the AI as a 'Digital Twin' of a Linux terminal. Because Gemini has read billions of lines of C++ and Python, it can accurately predict the output of 98% of standard logic. It's safer, faster, and infinitely more scalable." }
        ]
      },
      "On-Device Identity (Web Crypto API)": {
        topic: "On-Device Identity (Web Crypto API)",
        professorName: "Security Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "User privacy is paramount. In our system, your Private Keys never touch our database. We use the Web Crypto API to generate ECDSA P-256 keys directly in the browser." },
          { speaker: "Student", text: "So how do you verify transactions?" },
          { speaker: "Teacher", text: "We store a Public Certificate. When you send VoiceCoins, your browser signs the request locally. Our ledger simply verifies that the signature matches your registered public node. Total sovereignty." }
        ]
      }
    }
  }
};
