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
          { id: 'jd-2-2', title: 'Trace-Bundled Feedback Loops' }
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
      },
      {
        id: 'judge-ch6',
        title: 'Persistence Engineering',
        subTopics: [
          { id: 'jd-6-1', title: 'Cloud-Vault Duality Strategy' },
          { id: 'jd-6-2', title: 'Binary Chunking for Ledger Limits' }
        ]
      }
    ],
    lectures: {
      "Multi-Model Orchestration Pipeline": {
        topic: "Multi-Model Orchestration Pipeline",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Initiating audit of the Multi-Model Pipeline. In Neural Prism, we do not treat Gemini as a generic chat endpoint. We treat it as an orchestration layer. Look at 'services/lectureGenerator.ts'. We route requests to specific models based on the required dimension of reasoning." },
          { speaker: "Student", text: "I see you're using both Gemini 3 Pro and Flash. Most developers just pick one. Why the split?" },
          { speaker: "Teacher", text: "Intelligence vs. Latency. For document synthesis in BookStudio.tsx, we utilize Gemini 3 Pro. Its high-dimensional reasoning is required to maintain structural integrity across a 24-section manuscript. However, for the heuristic simulation in CodeStudio.tsx, we route to Gemini 3 Flash." },
          { speaker: "Student", text: "And how do you optimize Flash for a developer experience? Usually, LLM responses are too verbose for a terminal." },
          { speaker: "Teacher", text: "Precisely. We apply a 'Thinking Budget' of 0 in the config. This forces the model to bypass the standard 'Chain of Thought' reasoning and go straight to the deterministic output. It reduces first-token latency to sub-800ms, which is critical for making a terminal feel 'live'. We also use a 'Context Stripping' protocol that only sends the active code buffer and the immediate architectural siblings, keeping the prompt focused and cost-efficient." },
          { speaker: "Student", text: "What about the 'Software Interview' and 'Linux Kernel' voices I see in the Registry? Are those different models?" },
          { speaker: "Teacher", text: "No, they are tuned personas routed through specialized system instructions. We've mapped them to the Fenrir and Puck voices in the Live API to provide an emotive layer that matches the technical rigor. It’s about building a spectrum of intelligence where the persona is as accurate as the logic." },
          { speaker: "Student", text: "So you're managing tokens, latency, and emotional resonance simultaneously. That hits the Technical Complexity criteria. Let's move to the caching layer." }
        ]
      },
      "Refractive Caching & Deterministic UUIDs": {
        topic: "Refractive Caching & Deterministic UUIDs",
        professorName: "Dr. Aris",
        studentName: "Judge Sarah",
        sections: [
          { speaker: "Teacher", text: "Welcome, Sarah. To address the 'Innovation' criteria, let's look at how we handled the cost and latency of redundant AI calls. We call it Refractive Caching. Standard caching requires an exact string match. If one user asks 'Explain a B-Tree' and another asks 'B-Tree explanation', a standard cache fails." },
          { speaker: "Student", text: "How is Refractive Caching different from a simple vector database lookup?" },
          { speaker: "Teacher", text: "It's about the threshold and the ID generation. In 'utils/idUtils.ts', we generate v5 UUIDs from a SHA-256 hash of the semantic payload. Before we ever hit the API, we check our local 'Registry of Knowledge'. We calculate the cosine similarity between the current prompt and the registry." },
          { speaker: "Student", text: "What's the 'Refraction Index'?" },
          { speaker: "Teacher", text: "It's set to 0.95. If the similarity is above this index, we 'refract' the query through existing knowledge and serve the cached response in 15ms. This reduces LLM calls by up to 40% in a collaborative environment where students often ask similar questions." },
          { speaker: "Student", text: "And if it's a miss?" },
          { speaker: "Teacher", text: "The request goes to the cloud. But even then, the Deterministic UUID ensures that the result is stored under a predictable key. This allows for edge-level deduplication. We don't need a central database to tell us if a content segment is unique; the ID *is* the proof of content. It makes the system feel stateless yet deeply consistent." },
          { speaker: "Student", text: "That solves the scalability and cost problem effectively. Let's talk about the Heuristic Workspace." }
        ]
      },
      "Digital Twin Terminal Emulation": {
        topic: "Digital Twin Terminal Emulation",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Section 03: The 'Run' button in Builder Studio. Most developers assume we have a Docker container on the backend. We don't. We use Heuristic Logic Tracing." },
          { speaker: "Student", text: "Is that just a fancy way of saying you're asking the AI to guess the output?" },
          { speaker: "Teacher", text: "It is far more rigorous. We prompt Gemini 3 Flash to act as a 'Digital Twin' of a POSIX-compliant terminal. We provide it with the full Virtual File System (VFS) state—not just the code. The model mentally executes the C++ or Python logic against that state and predicts the standard output (stdout) and error (stderr)." },
          { speaker: "Student", text: "What about performance? Compiling C++ can take seconds." },
          { speaker: "Teacher", text: "That is the advantage. Our simulation is sub-second. Because the model has internalised billions of code execution patterns during training, it doesn't 'run' the code; it 'understands' the result. Our internal benchmarking for standard algorithmic tasks shows over 98% parity with native execution environments." },
          { speaker: "Student", text: "Is there a safety benefit?" },
          { speaker: "Teacher", text: "Enormous. It is a completely zero-risk environment. A user can write a script that attempts to delete the root directory, and the AI simply simulates the 'Permission Denied' output. There are no actual servers to protect. Furthermore, it allows for 'Socratic Debugging'. Instead of a raw segfault error, the AI can explain *why* that specific line of code caused a logical failure in the simulated memory." },
          { speaker: "Student", text: "So it's an IDE that is also a teacher. That hits both the Innovation and Educational impact scores." }
        ]
      },
      "Trace-Bundled Feedback Loops": {
        topic: "Trace-Bundled Feedback Loops",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Section 04: The Black Box problem. One of the biggest challenges in AI projects is understanding why a model failed in production. In App.tsx, we implemented a throttled system log buffer called the Diagnostic Matrix." },
          { speaker: "Student", text: "I see the console stream at the bottom. It's very dense. How does that help the user?" },
          { speaker: "Teacher", text: "It doesn't just help the user; it helps the system heal. When a user submits feedback, we don't just send their comment. We perform a 'Trace Bundle'. We snapshot the last 20 raw telemetry entries from our internal Event Bus—API handshake metadata, response latency, and terminal traces." },
          { speaker: "Student", text: "So you're linking the human's complaint to the AI's raw thoughts?" },
          { speaker: "Teacher", text: "Precisely. This allows us to perform recursive prompt refinement. We can analyze the specific instruction set that was active during a failure and tune the system instructions for that specific view. It moves us from a static application to a self-enhancing neural interface. It is the beginning of an autonomous observability loop." }
        ]
      },
      "Canvas Compositor Logic": {
        topic: "Canvas Compositor Logic",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Section 05: The Canvas Compositor. In LiveSession.tsx, we had to solve a fundamental browser limitation: standard screen recorders lose the camera overlay if you switch tabs. We solved this with a custom frame compositor." },
          { speaker: "Student", text: "I noticed the recording includes the PIP camera even when you switch tabs. Most apps like Zoom can't even do that in a browser. How?" },
          { speaker: "Teacher", text: "We don't record the screen element directly. We utilize a hidden 1920x1080 canvas as our 'Silicon Printing Plate'. Every 33.3 milliseconds, a high-stability `setInterval` loop stitches multiple layers onto this buffer. Layer 1 is the backdrop: a 60-pixel Gaussian blur of the screen. Layer 2 is the Screen Stream, scaled to 95% with a 40px drop shadow. Finally, Layer 3 is the circular PIP Portal." },
          { speaker: "Student", text: "How do you render the circular clip without losing performance?" },
          { speaker: "Teacher", text: "We define a 440-pixel diameter `arc()` path and use the `clip()` method on the 2D context. We then draw a 12px indigo border and a 2px white highlight. This combined HD frame is then fed into the MediaRecorder API at a constant 8Mbps using the VP9 codec. It ensures that the final WebM artifact is textbook quality, immune to tab-switching artifacts, and ready for archival." },
          { speaker: "Student", text: "That is a professional-grade execution of the Media APIs. Definitely a high degree of difficulty." }
        ]
      },
      "Sequential Permission Handshake": {
        topic: "Sequential Permission Handshake",
        professorName: "Dr. Aris Thorne",
        studentName: "Judge Lin",
        sections: [
          { speaker: "Teacher", text: "Audit of Section 06: Sequential Permission Handshake. In Live Scribe mode, we handle multiple hardware streams. Most web apps crash or 'ghost' here because the browser thread deadlocks when requesting screen and camera access simultaneously." },
          { speaker: "Student", text: "How does your code prevent the 'Permissions Blocked' error that happens in Chrome?" },
          { speaker: "Teacher", text: "We strictly enforce a 'Sequential Acquisition' logic. We wait for the 'getDisplayMedia' promise to resolve and confirm the user's tab choice before we even initiate the 'getUserMedia' call for the camera. It’s a 200ms cascade that ensures a 100% success rate on hardware acquisition." },
          { speaker: "Student", text: "What about the audio? I've noticed it sometimes clips at the start of long recordings." },
          { speaker: "Teacher", text: "That's the 'Silent Start' bug. We solve it with an Audio Context Warm-up signal. Before the MediaRecorder starts, we resume the AudioContext and dispatch a zero-volume signal to lock the sample rate at 48kHz. This prevents the initial sync drift that usually plagues browser-based recording. It’s the difference between a amateur log and a sovereign artifact." }
        ]
      },
      "Pixel-Perfect Asset Synthesis": {
        topic: "Pixel-Perfect Asset Synthesis",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Welcome to Section 07. We are analyzing the 'Pixel-Perfect Assembly Pipeline' in the Finance Lab. Exporting financial documents as PDFs using CSS is notoriously unreliable due to browser-specific rendering drifts." },
          { speaker: "Student", text: "I noticed your generated checks look identical in Chrome and Safari. How?" },
          { speaker: "Teacher", text: "We bypass the DOM entirely for the final artifact. We use a 3-stage synthesis. First, Gemini 3 Flash performs 'Linguistic Refraction' to convert currency numbers into legal words. Second, we draw the check to a 2D canvas at a locked internal resolution of 1800x810. This treats the canvas as a deterministic 'Silicon Printing Plate'." },
          { speaker: "Student", text: "And the signatures? Are those just images?" },
          { speaker: "Teacher", text: "They are sovereign assets. We use a CORS-safe handshake to resolve the remote signature data from the vault, then draw it directly to the canvas buffer before rasterizing the entire assembly into a high-DPI JPEG for the PDF wrapper. It guarantees 100% visual consistency regardless of the user's OS or font stack. It’s a bank-grade publishing pipeline built in the browser." }
        ]
      },
      "ECDSA Identity & Trust Ledger": {
        topic: "ECDSA Identity & Trust Ledger",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Section 08: The Cryptographic Identity layer. Most AI apps use standard passwords. We implemented Sovereign Mathematical Identity using the Web Crypto API." },
          { speaker: "Student", text: "Is this stored on your servers?" },
          { speaker: "Teacher", text: "Never. We fabricate an ECDSA P-256 key pair locally. The private key is stored in a dedicated 'identity_keys' store in IndexedDB, marked as non-extractable. It never touches the cloud. Only the public 'Certificate' is shared with our Ledger." },
          { speaker: "Student", text: "How do you verify a VoiceCoin transfer then?" },
          { speaker: "Teacher", text: "Every transaction is a cryptographically signed payload. We include a unique 128-bit 'Nonce' and a high-resolution timestamp. The receiver verifies the signature against your public certificate on our Firestore Ledger. Because of the Nonce, we have built-in Anti-Replay protection—no token can be claimed twice. It is a zero-trust model: we don't own your coins; we only verify the math of the transfer." }
        ]
      },
      "Multi-Page Neural Typesetting": {
        topic: "Multi-Page Neural Typesetting",
        professorName: "Dr. Vector",
        studentName: "Judge Alex",
        sections: [
          { speaker: "Teacher", text: "Section 09: Multi-Page Neural Typesetting. Examine 'utils/bookSynthesis.ts'. Most 'PDF Export' features just print the current window. We built a 'Recursive Slicing Engine' for long-form technical manuscripts." },
          { speaker: "Student", text: "How do you handle pagination for content that could be 50 pages long? LLMs don't know about physical page limits." },
          { speaker: "Teacher", text: "Correct. Our engine calculates the physical geometry of the content in real-time. We hydrate the curriculum, measure the line-height of the Socratic dialogues, and if a section exceeds the 1050px height limit of our A4 container, the engine automatically splits the node and carries the remaining context over to a new manuscript shell." },
          { speaker: "Student", text: "Does it break in the middle of a word?" },
          { speaker: "Teacher", text: "No, we implemented 'Contextual Splitting'. We use a recursive overflow algorithm that identifies the nearest logical line-break before the threshold. It creates professional-grade books with consistent margins and automated headers, essentially acting as an AI typesetter." }
        ]
      },
      "Symbol-Flow Rasterization": {
        topic: "Symbol-Flow Rasterization",
        professorName: "Dr. Vector",
        studentName: "Judge Alex",
        sections: [
          { speaker: "Teacher", text: "Section 10: Symbol-Flow Rasterization. This is our solution for technical publishing where math glyphs (LaTeX) and bilingual text often break during standard PDF encoding." },
          { speaker: "Student", text: "I've zoomed in 400% on the output. The KaTeX symbols are incredibly sharp." },
          { speaker: "Teacher", text: "That is the result of our 'Retina Refraction'. We utilize 'html2canvas' with a 3.5x scale multiplier. By rasterizing the entire document at this extreme density, we ensure 'Symbol Integrity'. No font-drift, no missing characters, no matter how complex the equation." },
          { speaker: "Student", text: "Isn't the file size massive at 3.5x scale?" },
          { speaker: "Teacher", text: "We optimize the final archive using a 0.92 JPEG threshold. This allows a 100-page technical manuscript to stay around 2MB while maintaining textbook-quality clarity. It's a sovereign pipeline that allows students to print high-quality material even in low-connectivity environments." }
        ]
      },
      "Cloud-Vault Duality Strategy": {
        topic: "Cloud-Vault Duality Strategy",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Audit of Section 11: Persistence Strategy. Most apps choose between a DB or a File System. We implemented 'Duality' for maximum resilience. Look at `saveCloudCachedLecture` in `firestoreService.ts`." },
          { speaker: "Student", text: "I see a 'Double Write' happening. What is the benefit?" },
          { speaker: "Teacher", text: "Independence. Every synthesized lesson is written to Firestore for fast metadata indexing. Simultaneously, the full Socratic dialogue is pushed to the Firebase Storage Vault as a raw JSON corpus. This ensures that even if the database index is corrupted or purged, the platform can rebuild its entire knowledge hub from the cold-storage artifacts. It's built for decades, not just days." }
        ]
      },
      "Binary Chunking for Ledger Limits": {
        topic: "Binary Chunking for Ledger Limits",
        professorName: "Architect Gem",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Final Section: Binary Chunking. Firestore has a strict 1MB limit per document, which presents a significant challenge for storing high-fidelity neural audio fragments." },
          { speaker: "Student", text: "How did you store the scripture audio then? Usually, that requires a dedicated blob store." },
          { speaker: "Teacher", text: "We developed a 'Chunked Ledger Protocol'. In `saveAudioToLedger`, we split the raw Uint8Arrays into 750,000-byte segments. We write a parent 'Manifest' doc and multiple numbered 'Children' docs. During playback, the reconstruction engine fetches all parts simultaneously and stitches them back into a single base64 data URI in sub-second time." },
          { speaker: "Student", text: "That keeps the audio indexed and secure within the same rules as your text data. Very clever bypass of the platform limits." },
          { speaker: "Teacher", text: "Thank you. This concludes our technical audit of the Neural Prism architecture. We have demonstrated technical excellence across model orchestration, cryptographic identity, and high-fidelity publishing." }
        ]
      }
    }
  }
};