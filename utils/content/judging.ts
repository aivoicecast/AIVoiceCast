
import { SpotlightChannelData } from '../spotlightContent';

export const JUDGING_CONTENT: Record<string, SpotlightChannelData> = {
  'judge-deep-dive': {
    curriculum: [
      {
        id: 'judge-ch1',
        title: 'Section 01: The Refractive Engine (Technical Execution)',
        subTopics: [
          { id: 'jd-1-1', title: 'Multi-Model Orchestration Pipeline' },
          { id: 'jd-1-2', title: 'Refractive Caching & Deterministic UUIDs' }
        ]
      },
      {
        id: 'judge-ch2',
        title: 'Section 02: The 30-Day Refraction (Engineering Story)',
        subTopics: [
          { id: 'jd-2-1', title: 'Vibe Coding 30K Lines with AI Studio' },
          { id: 'jd-2-2', title: 'Recursive Feedback & Drift Correction' }
        ]
      },
      {
        id: 'judge-ch3',
        title: 'Section 03: Finance Lab (Asset Synthesis)',
        subTopics: [
          { id: 'jd-3-1', title: 'Pixel-Perfect Assembly Pipeline' },
          { id: 'jd-3-2', title: 'Neural Signature Sovereignty' }
        ]
      },
      {
        id: 'judge-ch4',
        title: 'Section 04: Logistics Lab (Neural Ingest)',
        subTopics: [
          { id: 'jd-4-1', title: 'Linguistic Entity Extraction' },
          { id: 'jd-4-2', title: 'Geospatial Thermal Labeling' }
        ]
      },
      {
        id: 'judge-ch5',
        title: 'Section 05: Builder Studio (Heuristic Simulation)',
        subTopics: [
          { id: 'jd-5-1', title: 'Digital Twin Terminal Emulation' },
          { id: 'jd-5-2', title: 'Socratic Logic Tracing' }
        ]
      },
      {
        id: 'judge-ch6',
        title: 'Section 06: Career Hub (Multimodal Eval)',
        subTopics: [
          { id: 'jd-6-1', title: 'Technical Interrogation Protocols' },
          { id: 'jd-6-2', title: 'Sentiment & Performance Analysis' }
        ]
      },
      {
        id: 'judge-ch7',
        title: 'Section 07: Scripture Sanctuary (Sacred Data)',
        subTopics: [
          { id: 'jd-7-1', title: 'Bilingual Node Archiving' },
          { id: 'jd-7-2', title: 'Acoustic Archeology (Audio Nodes)' }
        ]
      },
      {
        id: 'judge-ch8',
        title: 'Section 08: Sovereign Vault (User Privacy)',
        subTopics: [
          { id: 'jd-8-1', title: 'Google Drive VFS Bridge' },
          { id: 'jd-8-2', title: 'Zero-Retention Logic Processing' }
        ]
      },
      {
        id: 'judge-ch9',
        title: 'Section 09: The Global Ledger (VoiceCoin)',
        subTopics: [
          { id: 'jd-9-1', title: 'ECDSA Identity Handshake' },
          { id: 'jd-9-2', title: 'Digital Receipt Escrow Flow' }
        ]
      },
      {
        id: 'judge-ch10',
        title: 'Section 10: Observability (Diagnostic Matrix)',
        subTopics: [
          { id: 'jd-10-1', title: 'Throttled Neural Log Buffer' },
          { id: 'jd-10-2', title: 'Trace Bundling for Feedback' }
        ]
      },
      {
        id: 'judge-ch11',
        title: 'Section 11: Future (Self-Evolution Loop)',
        subTopics: [
          { id: 'jd-11-1', title: 'Recursive Prompt Refinement' },
          { id: 'jd-11-2', title: 'Federated Refraction Roadmap' }
        ]
      },
      {
        id: 'judge-ch12',
        title: 'Section 12: High-Fidelity Publishing (Book Synthesis)',
        subTopics: [
          { id: 'jd-12-1', title: 'Multi-Page Neural Typesetting' },
          { id: 'jd-12-2', title: 'Symbol-Flow Rasterization Logic' }
        ]
      }
    ],
    lectures: {
      "Multi-Model Orchestration Pipeline": {
        topic: "Multi-Model Orchestration Pipeline",
        professorName: "Architect Gem",
        studentName: "Hackathon Judge",
        sections: [
          { speaker: "Teacher", text: "Welcome, Judges, to the v6.6.1 Technical Audit. Our core execution model is defined in App.tsx and geminiLive.ts. We don't just 'call an API'; we orchestrate a multi-model pipeline tailored for human activity." },
          { speaker: "Student", text: "How has the orchestration evolved in the latest version?" },
          { speaker: "Teacher", text: "We now have a dedicated 'Activity Circuit'. We use Gemini 3 Pro for high-dimensional reasoning like curriculum design, while gemini-2.5-flash-native-audio handles the low-latency WebSocket layer. The Builder Studio now features enhanced simulation accuracy, mentally tracing logic in C++ and Python with sub-second feedback loops." }
        ]
      },
      "Multi-Page Neural Typesetting": {
        topic: "Multi-Page Neural Typesetting",
        professorName: "Publishing Lead",
        studentName: "Engineering Judge",
        sections: [
          { speaker: "Teacher", text: "Section 12 covers our new Book Synthesis Engine. We've moved beyond simple text exports to professional multi-page manuscripts." },
          { speaker: "Student", text: "What are the core technical constraints of this engine?" },
          { speaker: "Teacher", text: "Governance and fidelity. We implement a strict '36-line safety frame' for every page to ensure consistent typesetting. The engine performs asynchronous Socratic dialogue generation for every node, then uses our Pixel-Perfect rasterization pipeline to bind the dialogues into an A4 PDF with AI-generated chapter summaries and scannable verification codes." },
          { speaker: "Student", text: "So it's a full publishing house in the browser?" },
          { speaker: "Teacher", text: "Exactly. It uses off-screen rendering nodes to capture the high-DPI state of each chapter, ensuring that math symbols and diagrams are preserved with 100% fidelity. It is the final stage of our 'Refraction' philosophy: from raw intelligence to a physical artifact." }
        ]
      },
      "Refractive Caching & Deterministic UUIDs": {
        topic: "Refractive Caching & Deterministic UUIDs",
        professorName: "System Lead",
        studentName: "Technical Auditor",
        sections: [
          { speaker: "Teacher", text: "In v6.6.1, cost efficiency and latency are managed via our refined hash-based caching layer in audioUtils.ts and db.ts." },
          { speaker: "Student", text: "Does this caching apply to the new Book Studio as well?" },
          { speaker: "Teacher", text: "Yes. Every synthesized dialogue is stored in our 'Neural Vault'. If a member refracts a lesson once, it is stored as a deterministic node for all others to access. This creates an energy-efficient knowledge economy where common technical definitions are never generated twice." }
        ]
      }
    }
  }
};
