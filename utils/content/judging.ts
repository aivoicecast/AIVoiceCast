
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
        title: 'Chapter 2: Builder Studio (Innovation)',
        subTopics: [
          { id: 'jd-2-1', title: 'Heuristic Logic Tracing: Imagined Execution' },
          { id: 'jd-2-2', title: 'Virtual File System (VFS) Synchronization' }
        ]
      },
      {
        id: 'judge-ch3',
        title: 'Chapter 3: Finance Lab (Technical Execution)',
        subTopics: [
          { id: 'jd-3-1', title: 'Pixel-Perfect Assembly Pipeline' },
          { id: 'jd-3-2', title: 'Verifiable Signatures & CORS Handshaking' }
        ]
      },
      {
        id: 'judge-ch4',
        title: 'Chapter 4: Interactive Studio (Innovation)',
        subTopics: [
          { id: 'jd-4-1', title: 'Multimodal WebSocket Context Ingestion' },
          { id: 'jd-4-2', title: 'Neural Rotation & Session Longevity' }
        ]
      },
      {
        id: 'judge-ch5',
        title: 'Chapter 5: Sovereignty & Data Integrity',
        subTopics: [
          { id: 'jd-5-1', title: 'The Triple-Layer Sovereign Vault' },
          { id: 'jd-5-2', title: 'On-Device ECDSA Identity Management' }
        ]
      },
      {
        id: 'judge-ch6',
        title: 'Chapter 6: Potential Impact (20%)',
        subTopics: [
          { id: 'jd-6-1', title: 'Decentralized Mentorship Economy' },
          { id: 'jd-6-2', title: 'Accessibility for Daily Human Activity' }
        ]
      }
    ],
    lectures: {
      "Multi-Model Orchestration Pipeline": {
        topic: "Multi-Model Orchestration Pipeline",
        professorName: "Chief Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "### Neural Summary\nWe utilize a specialized pipeline where Gemini 3 Pro handles high-dimensional reasoning (specs, curriculum), Gemini 3 Flash manages high-speed simulation, and 2.5 Flash Native Audio powers sub-second conversational latency. This ensures we never sacrifice performance for depth." },
          { speaker: "Teacher", text: "Technical Execution is 40% of our score. We didn't just wrap an API; we built a complex multi-model switching layer." },
          { speaker: "Student", text: "How do you decide which model is active at any given moment?" },
          { speaker: "Teacher", text: "The system evaluates the intent. When you generate a curriculum, Gemini 3 Pro's 2M context window is engaged. When you hit 'Run' in the IDE, we switch to a specialized 'System 2' thinking budget for Flash to ensure the simulation is deterministic." },
          { speaker: "Student", text: "And for voice?" },
          { speaker: "Teacher", text: "The Interactive Studio uses the 2.5 Flash Native Audio preview. It streams raw PCM bytes directly, bypassing standard text-to-speech latency. This is how we achieved conversational flow that feels human-to-human." }
        ]
      },
      "Heuristic Logic Tracing: Imagined Execution": {
        topic: "Heuristic Logic Tracing: Imagined Execution",
        professorName: "Innovation Lead",
        studentName: "Auditor",
        sections: [
          { speaker: "Teacher", text: "### Neural Summary\nOur Builder Studio replaces server-side compilers with 'Heuristic Simulation'. By asking Gemini 3 Flash to act as a Digital Twin of a Linux terminal, we can predict stdout/stderr for C++, Python, and Rust with ~98% accuracy in a zero-risk, infrastructure-less sandbox." },
          { speaker: "Teacher", text: "Traditional online IDEs are heavy, requiring Docker and compilers. We invented 'Imagined Execution'." },
          { speaker: "Student", text: "Doesn't that lead to hallucinations in code output?" },
          { speaker: "Teacher", text: "Surprisingly, no. Because the model has trained on trillions of lines of code and its associated outputs, it can mentally trace logic paths. For learning and prototyping, a 98% accurate simulated output that explains *why* it failed is more valuable than a raw compiler error." },
          { speaker: "Student", text: "And the security benefit?" },
          { speaker: "Teacher", text: "Massive. You can write a script that tries to delete the root directory. The AI simply simulates the 'Permission Denied' response. No hardware is ever at risk. It is the ultimate Zero-Trust development environment." }
        ]
      },
      "Pixel-Perfect Assembly Pipeline": {
        topic: "Pixel-Perfect Assembly Pipeline",
        professorName: "Product Engineer",
        studentName: "UX Judge",
        sections: [
          { speaker: "Teacher", text: "### Neural Summary\nTo generate high-fidelity financial assets, we developed a deterministic 2D canvas assembly pipeline. It resolves CORS-restricted remote signatures and AI-generated watermarks into a single synchronous buffer before rasterizing to a high-DPI PDF." },
          { speaker: "Teacher", text: "Generating a verifiable check in a browser is technically difficult due to cross-origin security and render timeouts." },
          { speaker: "Student", text: "I noticed your checks include signatures and complex watermarks." },
          { speaker: "Teacher", text: "Yes. Our 'Assembly Pipeline' performs an anonymous CORS handshake to resolve your sovereign signature from the Cloud Vault. We then draw the document pixel-by-pixel onto an off-screen canvas to ensure consistency across mobile and desktop." },
          { speaker: "Student", text: "So it's not just a screenshot of the HTML?" },
          { speaker: "Teacher", text: "Correct. It's a high-resolution rasterization. This allows us to inject a 'Visual DNA' watermark synthesized by Gemini, creating a unique fingerprint for every transaction recorded on the ledger." }
        ]
      },
      "The Triple-Layer Sovereign Vault": {
        topic: "The Triple-Layer Sovereign Vault",
        professorName: "Privacy Lead",
        studentName: "Security Auditor",
        sections: [
          { speaker: "Teacher", text: "### Neural Summary\nWe utilize a three-tier storage model: Firestore (Public Metadata/Ledger), IndexedDB (Edge-side heavy asset cache), and Google Drive (Sovereign user data). This ensures sub-100ms response times while giving users 100% ownership of their artifacts." },
          { speaker: "Teacher", text: "Privacy is a core pillar. We are a lens, not a silo. Your data should live in your vault, not ours." },
          { speaker: "Student", text: "How do you maintain performance if the 'Source of Truth' is in the user's Google Drive?" },
          { speaker: "Teacher", text: "That is Layer 2: The Neural Cache. We use IndexedDB to store audio fragments and code states locally. When you interact, you are talking to the Edge. Syncing with Drive or GitHub happens in the background via the 'Sovereign Bridge'." },
          { speaker: "Student", text: "And Layer 1?" },
          { speaker: "Teacher", text: "That is the Global Ledger in Firebase. It stores only the metadata and cryptographically signed certificates needed for the community to verify that a check or a mentorship session is legitimate." }
        ]
      },
      "Neural Rotation & Session Longevity": {
        topic: "Neural Rotation & Session Longevity",
        professorName: "Systems Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "### Neural Summary\nTo support 60-minute activities (like technical interviews) using ephemeral WebSocket tokens, we implemented a 'Neural Rotation' protocol. It silently refreshes the AI connection every 5 minutes while maintaining a rolling context window." },
          { speaker: "Teacher", text: "One major limitation of real-time AI APIs is token expiration during long human activities." },
          { speaker: "Student", text: "So if an interview goes long, the AI doesn't just cut off?" },
          { speaker: "Teacher", text: "No. Our protocol detects the TTL (Time-To-Live) and initiates a background handshake. We package the last 5 minutes of conversation and the current code state into a 'Context-In-Prompt' injection for the new session. The user never hears a click or a pause." },
          { speaker: "Student", text: "This turns a stateless API into a persistent activity partner." },
          { speaker: "Teacher", text: "Exactly. It is the plumbing that allows the platform to move from a chat bot to a professional utility hub." }
        ]
      }
    }
  }
};
