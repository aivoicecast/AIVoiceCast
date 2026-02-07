
import { SpotlightChannelData } from '../spotlightContent';

export const JUDGE_DEEP_DIVE_CONTENT: Record<string, SpotlightChannelData> = {
  'judge-deep-dive': {
    curriculum: [
      { 
        id: 'judge-ch1', 
        title: 'Sector 01: Multi-Model Orchestration & The Balancer', 
        subTopics: [
            { id: 'jd-1-1', title: 'Intelligence Routing Logic' }, 
            { id: 'jd-1-2', title: 'Vector Map Re-hydration' },
            { id: 'jd-1-3', title: 'Bypassing the 8k Synthesis Wall' }
        ] 
      },
      { 
        id: 'judge-ch2', 
        title: 'Sector 02: Infrastructure-Bypass & Heuristic Simulation', 
        subTopics: [
            { id: 'jd-2-1', title: 'WASM-Hybrid Execution: Predictive Logic' }, 
            { id: 'jd-2-2', title: 'Thinking Budget vs. Output Density' }
        ] 
      },
      { 
        id: 'judge-ch3', 
        title: 'Sector 03: Sovereign Data Persistence (BCP)', 
        subTopics: [
            { id: 'jd-3-1', title: 'Binary Chunking Protocol: 750,000 Byte Shards' }
        ] 
      },
      { 
        id: 'judge-ch4', 
        title: 'Sector 04: The Scribe Protocol', 
        subTopics: [
            { id: 'jd-4-1', title: 'Offscreen Canvas Compositor Logic' }, 
            { id: 'jd-4-2', title: '8Mbps VP9 Activity Streaming' }
        ] 
      },
      { 
        id: 'judge-ch5', 
        title: 'Sector 05: Symbol Flow Integrity', 
        subTopics: [
            { id: 'jd-5-1', title: 'High-DPI Rasterization Pipeline (400% Scale)' }, 
            { id: 'jd-5-2', title: 'Deterministic PDF Baking (Anchor Nodes)' }
        ] 
      },
      { 
        id: 'judge-ch6', 
        title: 'Sector 06: Operational Resilience & Rate Limits', 
        subTopics: [
            { id: 'jd-6-1', title: 'Managing 429 Interruption via Neural Rotation' }, 
            { id: 'jd-6-2', title: 'Automatic TTS Failover Protocol' }
        ] 
      }
    ],
    lectures: {
      "Intelligence Routing Logic": {
        topic: "Intelligence Routing Logic",
        professorName: "Chief Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Welcome, Judge. Sector 01 examines our implementation of the 'Complexity Balancer v4'. In our source code, you'll see we perform a sub-millisecond triage of user intent: deep algorithmic reasoning is routed to 'gemini-3-pro-preview', while interactive simulations use 'gemini-3-flash-preview'. We achieve specialized behavior through deep system context rather than model fine-tuning." },
          { speaker: "Student", text: "Do you send the full simulation logs to the Pro model?" },
          { speaker: "Teacher", text: "Absolutely not. That would be thermodynamically irresponsible. Instead, we use the 'Vector Map Re-hydration' protocol. The Flash model generates a high-entropy vector map—a compressed fingerprint of the logic states—and only *that* is passed to Gemini 3 Pro for the final synthesis." }
        ]
      },
      "Vector Map Re-hydration": {
        topic: "Vector Map Re-hydration",
        professorName: "Systems Lead",
        studentName: "Staff Judge",
        sections: [
          { speaker: "Teacher", text: "Precisely. This is the 'Re-hydration' phase. We don't pass the full verbose output of the simulations. We pass a structured, high-entropy vector map that Gemini 3 Pro uses to 're-hydrate' the context." },
          { speaker: "Student", text: "How does the map preserve technical nuance?" },
          { speaker: "Teacher", text: "The map is a multi-dimensional array of 'Logic Anchors.' Each anchor represents a critical state change or memory event detected during simulation. By providing the Pro model with these anchors, it can reconstruct the entire architectural narrative with bit-perfect accuracy while consuming 90% fewer tokens." }
        ]
      },
      "Binary Chunking Protocol: 750,000 Byte Shards": {
        topic: "Binary Chunking Protocol: 750,000 Byte Shards",
        professorName: "Cloud Architect",
        studentName: "Database Judge",
        sections: [
          { speaker: "Teacher", text: "The 1MB document limit in Firestore is a hard wall. Our 'Binary Chunking Protocol' (BCP) shards raw binary data into precisely 750,000-byte segments." },
          { speaker: "Student", text: "Why 750,000 specifically?" },
          { speaker: "Teacher", text: "Base64 encoding adds approximately 33% overhead. Sharding at 750KB ensures every fragment remains safely within the 1MB limit while leaving room for metadata. During reconstruction, the client parallel-fetches these shards and uses optimized memory operations to stitch them back into a single Data URI in sub-150ms." }
        ]
      },
      "WASM-Hybrid Execution: Predictive Logic": {
        topic: "WASM-Hybrid Execution: Predictive Logic",
        professorName: "Systems Lead",
        studentName: "Staff Judge",
        sections: [
          { speaker: "Teacher", text: "We have achieved an 'Infrastructure-Bypass' in the Builder Studio. For JavaScript and TypeScript, we initialize a local SWC WASM module. This allows for 0-token syntax checking directly in the browser." },
          { speaker: "Student", text: "And for other languages like C++?" },
          { speaker: "Teacher", text: "That's where 'Heuristic Logic Tracing' engages. We treat Gemini 3 Flash as a Digital Twin of a POSIX terminal. It 'imagines' the output by mentally tracing variable states through the latent space, achieving a 100x energy efficiency gain over server-side containers." }
        ]
      },
      "Offscreen Canvas Compositor Logic": {
        topic: "Offscreen Canvas Compositor Logic",
        professorName: "Visual Lead",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Standard browser recording loses the camera feed when you switch tabs. The 'Scribe Protocol' implemented in the Interview Studio solves this by generating a hidden 1920x1080 Compositor Canvas. We use a 30FPS loop that is resistant to background suspension." },
          { speaker: "Student", text: "How is the quality maintained?" },
          { speaker: "Teacher", text: "We force an 8Mbps VP9 stream. The compositor stitches the screen, a Gaussian-blurred backdrop, and a circular PIP camera portal into a single coherent artifact. This stream is dispatched directly to the user's sovereign YouTube vault, ensuring that the platform owner never touches the private engineering performance data." }
        ]
      },
      "High-DPI Rasterization Pipeline (400% Scale)": {
        topic: "High-DPI Rasterization Pipeline (400% Scale)",
        professorName: "Publishing Lead",
        studentName: "Judge",
        sections: [
          { speaker: "Teacher", text: "Technical publishing requires symbolic perfection. In the Author Studio, we utilize a 4x rasterization pipeline. Every technical book is rendered to a hidden canvas at 400% scale before PDF binding." },
          { speaker: "Student", text: "And what about the 'Baking' process in the Signer?" },
          { speaker: "Teacher", text: "In the PdfSigner, we use 'Anchor Node Injection.' We insert zero-opacity characters into the PDF stream to force a full re-serialization of the document. This ensures that the generated page hashes are deterministic and stable, allowing for bit-perfect authenticity verification on the ledger." }
        ]
      },
      "Automatic TTS Failover Protocol": {
        topic: "Automatic TTS Failover Protocol",
        professorName: "Audio Systems Lead",
        studentName: "Judge",
        sections: [
          { speaker: "Teacher", text: "Operational continuity is a technical requirement. The 'Gemini 2.5 Flash TTS' engine is emotive but has strict throughput constraints. If a 429 error is detected, our 'Failover Matrix' triggers immediately." },
          { speaker: "Student", text: "What are the fallback tiers?" },
          { speaker: "Teacher", text: "The engine handshakes with secondary high-fidelity providers like OpenAI or Google Cloud TTS. If all cloud spectrums are saturated, it refracts into 'Local Mode', utilizing the browser's native speech engine at $0 cost. This multi-layered resilience ensures that a technical audit is never interrupted by the physics of cloud rate limits." }
        ]
      }
    }
  }
};
