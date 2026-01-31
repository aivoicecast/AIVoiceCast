import { SpotlightChannelData } from '../spotlightContent';

export const JUDGING_CONTENT: Record<string, SpotlightChannelData> = {
  'judge-deep-dive': {
    curriculum: [
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
          { id: 'jd-2-1', title: 'Digital Twin Terminal Emulation' },
          { id: 'jd-2-2', title: 'Socratic Logic Tracing' }
        ]
      },
      {
        id: 'judge-ch3',
        title: 'Scribe Protocol & Capture',
        subTopics: [
          { id: 'jd-3-1', title: 'Canvas Compositor Logic' },
          { id: 'jd-3-2', title: 'Sequential Permission Handshake' }
        ]
      },
      {
        id: 'judge-ch4',
        title: 'Sovereign Utility Labs',
        subTopics: [
          { id: 'jd-4-1', title: 'Pixel-Perfect Asset Synthesis' },
          { id: 'jd-4-2', title: 'ECDSA Identity & Trust Ledger' }
        ]
      },
      {
        id: 'judge-ch5',
        title: 'Synthesis & Publishing',
        subTopics: [
          { id: 'jd-5-1', title: 'Multi-Page Neural Typesetting' },
          { id: 'jd-5-2', title: 'Symbol-Flow Rasterization' }
        ]
      }
    ],
    lectures: {
      "Multi-Model Orchestration Pipeline": {
        topic: "Multi-Model Orchestration Pipeline",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Initiating audit of the Multi-Model Pipeline. We orchestrate a spectrum: Gemini 3 Pro for complex document synthesis and Gemini 3 Flash for low-latency heuristic simulation." },
          { speaker: "Student", text: "Why split the tasks across different models?" },
          { speaker: "Teacher", text: "Efficiency vs. Intelligence. Flash with a thinking budget of 0 handles sub-second terminal output in CodeStudio.tsx. Pro's high-dimensional reasoning is required in BookStudio.tsx to typeset 24 sections into a professional manuscript." }
        ]
      },
      "Digital Twin Terminal Emulation": {
        topic: "Digital Twin Terminal Emulation",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Examining the 'Run' button in Builder Studio. We bypass server-side compilers entirely using Neural Simulation." },
          { speaker: "Student", text: "Is that just a text guess of the output?" },
          { speaker: "Teacher", text: "No. It is a Heuristic Trace. We prompt Gemini 3 Flash as a Digital Twin Terminal. It mentally executes the C++ or Python logic and predicts the standard output. It is infrastructure-less, zero-risk, and allows for Socratic Debugging where the AI explains the logic failure." }
        ]
      },
      "Canvas Compositor Logic": {
        topic: "Canvas Compositor Logic",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Audit of Scribe Protocol in LiveSession.tsx. High-fidelity workspace capture uses a custom Canvas Compositor." },
          { speaker: "Student", text: "How do you handle the Picture-in-Picture camera overlay?" },
          { speaker: "Teacher", text: "We implemented a compositor that stitches the screen stream and camera stream onto a hidden HD canvas at 30 FPS. This combined frame is fed into the MediaRecorder API to ensure zero visual artifacts and perfect audio synchronization." }
        ]
      },
      "Pixel-Perfect Asset Synthesis": {
        topic: "Pixel-Perfect Asset Synthesis",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Analyzing the Finance Lab. We've bypassed CSS-to-PDF limitations using a 3-stage synthesis pipeline." },
          { speaker: "Student", text: "What are the stages?" },
          { speaker: "Teacher", text: "First, Neural Word Refraction. Second, 1800x810 High-DPI rasterization. Finally, we bind the signature—a sovereign asset synced from the User Profile—using an off-screen canvas. Result: 100% consistency across devices." }
        ]
      },
      "ECDSA Identity & Trust Ledger": {
        topic: "ECDSA Identity & Trust Ledger",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Sovereignty is our core philosophy. Identity is generated on-device using the Web Crypto API, not on our servers." },
          { speaker: "Student", text: "Explain the Digital Receipt handshake." },
          { speaker: "Teacher", text: "Every VoiceCoin transfer is a cryptographic handshake. The sender signs a payload with their ECDSA P-256 private key. The receiver verifies it against the public certificate on the ledger. User owns the key." }
        ]
      }
    }
  }
};
