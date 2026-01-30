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
          // Fixed: Added missing colon after id property to resolve "Cannot find name 'id'" and type error for 'jd-9-2'.
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
      }
    ],
    lectures: {
      "Multi-Model Orchestration Pipeline": {
        topic: "Multi-Model Orchestration Pipeline",
        professorName: "Architect Gem",
        studentName: "Hackathon Judge",
        sections: [
          { speaker: "Teacher", text: "Welcome, Judges. Our core execution model is defined in App.tsx and geminiLive.ts. We don't just 'call an API'; we orchestrate a multi-model pipeline." },
          { speaker: "Student", text: "How do you split the work between the different Gemini versions?" },
          { speaker: "Teacher", text: "We use Gemini 3 Pro for heavy reasoning, like generating the 10-chapter curriculums in curriculumGenerator.ts. For the real-time interactive studio, we utilize gemini-2.5-flash-native-audio to achieve sub-second voice latency. Finally, for the Builder Studio's terminal emulation, we hit Gemini 3 Flash with a zero-thinking budget for instant 'Heuristic Execution'." }
        ]
      },
      "Refractive Caching & Deterministic UUIDs": {
        topic: "Refractive Caching & Deterministic UUIDs",
        professorName: "System Lead",
        studentName: "Technical Auditor",
        sections: [
          { speaker: "Teacher", text: "Cost efficiency is key to viability. In audioUtils.ts and db.ts, we implemented a hash-based caching layer for neural audio fragments." },
          { speaker: "Student", text: "So you don't re-synthesize common phrases?" },
          { speaker: "Teacher", text: "Exactly. We use SHA-256 fingerprints of the text and voice name to create deterministic UUIDs. This allows the Scripture Sanctuary to play verses instantly from IndexedDB, saving thousands of tokens per session while providing a zero-latency experience." }
        ]
      },
      "Vibe Coding 30K Lines with AI Studio": {
        topic: "Vibe Coding 30K Lines with AI Studio",
        professorName: "Lead Engineer",
        studentName: "Engineering Judge",
        sections: [
          { speaker: "Teacher", text: "Node 2 is our story. This platform consists of approximately 30,000 lines of complex TypeScript, nearly all generated through high-frequency 'Vibe Coding' in Google AI Studio." },
          { speaker: "Student", text: "How did you keep the code from turning into 'spaghetti' over 30 days?" },
          { speaker: "Teacher", text: "Structure and Refraction. We maintained a rigid types.ts file and used the 'Project Story' (ProjectStory.tsx) as a living blueprint. We fed the model its own architectural decisions recursively, ensuring that new components like the CardWorkshop.tsx followed the same VFS and storage patterns as the older ones." }
        ]
      },
      "Pixel-Perfect Assembly Pipeline": {
        topic: "Pixel-Perfect Assembly Pipeline",
        professorName: "Finance Architect",
        studentName: "Judge Casey",
        sections: [
          { speaker: "Teacher", text: "In CheckDesigner.tsx, we found that standard HTML-to-PDF tools couldn't handle our security watermarks. So we built the Pixel-Perfect Assembly Pipeline." },
          { speaker: "Student", text: "I see you're using a hidden 1800-pixel canvas?" },
          { speaker: "Teacher", text: "Yes. The function assembleCheckCanvas() manually draws every layer—the neural seal, the scannable QR code, and the authorized signature—onto a high-DPI 2D context. This raster is then 'bound' into a PDF via jsPDF, ensuring forensic-level clarity for banking documents regardless of the user's browser rendering engine." }
        ]
      },
      "Linguistic Entity Extraction": {
        topic: "Linguistic Entity Extraction",
        professorName: "Logistics Lead",
        studentName: "Judge Riley",
        sections: [
          { speaker: "Teacher", text: "The ShippingLabelApp.tsx uses 'Neural Ingest'. It's a prime example of turning super-intelligence into a mundane utility." },
          { speaker: "Student", text: "You just paste raw text from an email, right?" },
          { speaker: "Teacher", text: "Correct. We use Gemini 3 Flash as a zero-shot parser. It extracts the name, street, city, and ZIP code into a structured JSON schema instantly. It removes the friction of manual entry, effectively refracting a 'messy' human input into a 'clean' logistics output for thermal printing." }
        ]
      },
      "Geospatial Thermal Labeling": {
        topic: "Geospatial Thermal Labeling",
        professorName: "Logistics Architect",
        studentName: "Judge Sam",
        sections: [
          { speaker: "Teacher", text: "Node 4 also handles the 'Physical Bridge'. When a label is generated, we don't just save a file; we calculate coordinates for thermal paper." },
          { speaker: "Student", text: "Is that the barcode logic?" },
          { speaker: "Teacher", text: "Yes. We use the barcodeapi.org link to generate standard 128-bit identifiers, which are then precisely positioned on the 4x6 inch raster. This ensures that every 'Neural Label' is geospatial-ready for global courier scans." }
        ]
      },
      "Digital Twin Terminal Emulation": {
        topic: "Digital Twin Terminal Emulation",
        professorName: "Builder Lead",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Our most innovative feature is 'Heuristic Simulation' in CodeStudio.tsx. We execute code without a real server-side compiler." },
          { speaker: "Student", text: "Wait, so there's no real Linux container running the code?" },
          { speaker: "Teacher", text: "None. We instruct Gemini 3 Flash to act as a 'Digital Twin' of a terminal. It mentally traces the logic of the C++ or Python code and predicts the output. It is 100% secure, infrastructure-less, and faster than booting a real VM. This is the future of 'safe-sandbox' learning." }
        ]
      },
      "Technical Interrogation Protocols": {
        topic: "Technical Interrogation Protocols",
        professorName: "Career Hub Lead",
        studentName: "Judge Sam",
        sections: [
          { speaker: "Teacher", text: "MockInterview.tsx utilizes the Live API for multimodal evaluation. The AI interviewer persona is dynamic." },
          { speaker: "Student", text: "How does the interviewer 'see' what the candidate is doing in the IDE?" },
          { speaker: "Teacher", text: "Through the 'Neural Snapshot'. Every turn, the candidate's active code is bundled into the voice stream's text context. The AI interviewer doesn't just hear you; it evaluates your logic as it evolves on screen, providing real-time technical pressure identical to a Staff Engineer interview." }
        ]
      },
      "Bilingual Node Archiving": {
        topic: "Bilingual Node Archiving",
        professorName: "Sanctuary Architect",
        studentName: "Judge Lin",
        sections: [
          { speaker: "Teacher", text: "ScriptureSanctuary.tsx handles 'Sacred Data' using an Atomic Node structure. Every verse is an individual ledger entry." },
          { speaker: "Student", text: "What is the benefit of breaking it down so small?" },
          { speaker: "Teacher", text: "Granular verification. Each verse node is independently searchable and cached. By using the BIBLE_LEDGER_COLLECTION in Firestore, we enable high-speed bilingual synchronization during live discussions, allowing the AI 'Host' to have perfect context of ancient texts in both English and Chinese." }
        ]
      },
      "Google Drive VFS Bridge": {
        topic: "Google Drive VFS Bridge",
        professorName: "Privacy Officer",
        studentName: "Judge Alex",
        sections: [
          { speaker: "Teacher", text: "User privacy is baked into the storage.rules and googleDriveService.ts. We use a Sovereign Bridge model." },
          { speaker: "Student", text: "So Neural Prism doesn't actually store my source code?" },
          { speaker: "Teacher", text: "Never. We act as a refractive lens. We process the code for simulation, but the persistent artifact—whether it's a C++ file or a generated PDF—exists only in the user's sovereign Google Drive vault. This checks the 'Sovereignty' box by ensuring zero-retention of user IP on our servers." }
        ]
      },
      "ECDSA Identity Handshake": {
        topic: "ECDSA Identity Handshake",
        professorName: "Ledger Architect",
        studentName: "Security Auditor",
        sections: [
          { speaker: "Teacher", text: "VoiceCoin transactions in CoinWallet.tsx are secured via cryptoUtils.ts using the Web Crypto API." },
          { speaker: "Student", text: "Do you use a central authority to sign payments?" },
          { speaker: "Teacher", text: "No. We generate ECDSA P-256 key pairs locally in the user's browser. When you send coins, you sign the 'Digital Receipt' locally. We only verify the public signature on the Firestore ledger. It's a decentralized trust model that gives users full control over their neural assets." }
        ]
      },
      "Throttled Neural Log Buffer": {
        topic: "Throttled Neural Log Buffer",
        professorName: "Observability Architect",
        studentName: "Stability Judge",
        sections: [
          { speaker: "Teacher", text: "In App.tsx, we built a custom Diagnostic Console to track all AI handshakes without lagging the UI." },
          { speaker: "Student", text: "I noticed the logs update smoothly even during rapid voice chat." },
          { speaker: "Teacher", text: "That is the Throttled Log Buffer. We decouple the 'neural-log' events from the React render cycle, updating the visible trace every 800ms. This ensures developer-level observability (including raw JSON payloads) without sacrificing frame rates during high-intensity activities." }
        ]
      },
      "Recursive Prompt Refinement": {
        topic: "Recursive Prompt Refinement",
        professorName: "Evolution Lead",
        studentName: "Future Judge",
        sections: [
          { speaker: "Teacher", text: "Node 11 is about the future: our Self-Evolution Loop. We use FeedbackManager.tsx to refine the system itself." },
          { speaker: "Student", text: "Does the system learn from its own mistakes?" },
          { speaker: "Teacher", text: "Yes. When a user submits feedback, we perform 'Trace Bundling'—attaching the last 20 log entries (including model instructions and errors) to the report. This provides the context needed for us to perform recursive refinement of our system instructions in AI Studio, creating a platform that learns from every refraction." }
        ]
      }
    }
  }
};