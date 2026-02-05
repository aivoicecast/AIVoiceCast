
import { SpotlightChannelData } from '../spotlightContent';

export const JUDGE_DEEP_DIVE_CONTENT: Record<string, SpotlightChannelData> = {
  'judge-deep-dive': {
    curriculum: [
      { 
        id: 'judge-ch1', 
        title: 'Sector 01: Multi-Model Orchestration & The Balancer', 
        subTopics: [
            { id: 'jd-1-1', title: 'Intelligence Routing Logic' }, 
            { id: 'jd-1-2', title: 'Bypassing the 8k Synthesis Wall' }
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
            { id: 'jd-3-1', title: 'Binary Chunking Protocol: 750,000 Byte Shards' }, 
            { id: 'jd-3-2', title: 'Zero-Copy Reconstruction Performance' }
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
            { id: 'jd-5-2', title: 'Deterministic PDF Baking' }
        ] 
      },
      { 
        id: 'judge-ch6', 
        title: 'Sector 06: Operational Resilience & Rate Limits', 
        subTopics: [
            { id: 'jd-6-1', title: 'Managing 429 Interruption via Neural Rotation' }, 
            { id: 'jd-6-2', title: 'Automatic TTS Failover Protocol' }
        ] 
      },
      { 
        id: 'judge-ch7', 
        title: 'Sector 07: 2036 Vision: The 10:1 Ratio', 
        subTopics: [
            { id: 'jd-7-1', title: 'Distributed Hardware Mesh' }, 
            { id: 'jd-7-2', title: 'Neural Energy Economics (VoiceCoin)' }
        ] 
      },
      { 
        id: 'judge-ch8', 
        title: 'Sector 08: Neural Identity Shards (Tuned Models)', 
        subTopics: [
            { id: 'jd-8-1', title: 'Tuned Refraction: Shard 0648937375' }, 
            { id: 'jd-8-2', title: 'Tuned Refraction: Shard 0375218270' }
        ] 
      },
      { 
        id: 'judge-ch9', 
        title: 'Sector 09: The Executive Architect (Default Gem)', 
        subTopics: [
            { id: 'jd-9-1', title: 'The Fallback Logic Gate' }, 
            { id: 'jd-9-2', title: 'Orchestrating High-Dimensional Synthesis' }
        ] 
      }
    ],
    lectures: {
      "Intelligence Routing Logic": {
        topic: "Intelligence Routing Logic",
        professorName: "Chief Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Welcome, Judge. Sector 01 examines the 'Complexity Balancer v4'. In our source code, you'll see we do not rely on a single model. We perform a sub-millisecond triage of user intent: algorithmic reasoning is routed to 'gemini-3-pro-preview' with a 15,000-token thinking budget, while high-frequency workspace simulations use 'gemini-3-flash-preview' with a thinking budget of 0 to minimize latency." },
          { speaker: "Student", text: "How does the code studio handle this orchestration?" },
          { speaker: "Teacher", text: "The CodeStudio component manages a 'Neural Snapshot' system. It bundles the entire project tree and current cursor deltas into the prompt prefix. By using Flash for the simulation and Pro for the end-of-session 'Technical Audit', we achieve a balance between sub-800ms interactivity and deep Staff-level evaluation. This is thermodynamic orchestration: we only use the energy required for the specific refraction." }
        ]
      },
      "The Fallback Logic Gate": {
        topic: "The Fallback Logic Gate",
        professorName: "Identity Architect",
        studentName: "Auditor",
        sections: [
          { speaker: "Teacher", text: "Sector 09 details the 'Default Gem.' In our code, this identity is not bound to a tuned shard. Instead, it routes directly to the raw 'gemini-3-pro-preview' logic gate." },
          { speaker: "Student", text: "Why is this the Default?" },
          { speaker: "Teacher", text: "Because the Pro model is our 'Executive Architect.' It possesses the highest reasoning density across the entire spectrum. While the tuned shards like '0648' provide specific professional friction, the Default Gem is responsible for synthesizing the cross-functional documents you see in the Author Studio. It acts as the 'Primary Lens' for the platform's self-documentation." }
        ]
      },
      "Tuned Refraction: Shard 0648937375": {
        topic: "Tuned Refraction: Shard 0648937375",
        professorName: "Identity Architect",
        studentName: "Auditor",
        sections: [
          { speaker: "Teacher", text: "Sector 08 explores the use of Tuned Models as 'Identity Shards.' Specifically, the 'Software Interview Voice' utilizes model `gen-lang-client-0648937375`. This is not just a name; it is a high-density logic gate." },
          { speaker: "Student", text: "What are the benefits of using a tuned shard over a system prompt?" },
          { speaker: "Teacher", text: "Efficiency and Intuition. Shard `0648937375` has been fine-tuned on Staff-level interview collisions. It possesses an inherent 'Socratic Friction' that would normally consume 2,000 tokens of system instructions. By using the shard, we preserve the context window for the user's code while maintaining a professional, rigorous persona that demands Big-O analysis by default. This is 'Zero-Token Persona' injection." }
        ]
      },
      "Tuned Refraction: Shard 0375218270": {
        topic: "Tuned Refraction: Shard 0375218270",
        professorName: "Systems Architect",
        studentName: "Kernel Judge",
        sections: [
          { speaker: "Teacher", text: "Shard `gen-lang-client-0375218270` powers the Linux Kernel Architect persona. This model has been refined specifically for memory safety and pointer arithmetic logic." },
          { speaker: "Student", text: "How does it interact with the Heuristic Simulator?" },
          { speaker: "Teacher", text: "It acts as the 'Validator.' While standard Flash predicts the terminal output, Shard `0375218270` is cross-referenced during the Technical Audit to identify 'Latent Instabilities'—race conditions or memory leaks that the simulator might miss. It provides the deep systems expertise required to audit code at the kernel level. This multi-shard strategy ensures that the Neural Prism provides 100% technical honesty across different engineering domains." }
        ]
      },
      "WASM-Hybrid Execution: Predictive Logic": {
        topic: "WASM-Hybrid Execution: Predictive Logic",
        professorName: "Systems Lead",
        studentName: "Staff Judge",
        sections: [
          { speaker: "Teacher", text: "We have achieved an 'Infrastructure-Bypass' in the Builder Studio. For JavaScript and TypeScript, we initialize a local SWC (Speedy Web Compiler) WASM module. This allows for 0-token, $0-cost syntax checking and transpilation directly in the browser." },
          { speaker: "Student", text: "And for other languages like C++ or Python?" },
          { speaker: "Teacher", text: "That's where 'Heuristic Logic Tracing' engages. We treat Gemini 3 Flash as a Digital Twin of a POSIX terminal. It 'imagines' the stdout and stderr by mentally tracing variable states through the latent space. This eliminates the need for expensive server-side containers and provides absolute security—malicious code is never physically executed, only neurally predicted." }
        ]
      },
      "Binary Chunking Protocol: 750,000 Byte Shards": {
        topic: "Binary Chunking Protocol: 750,000 Byte Shards",
        professorName: "Cloud Architect",
        studentName: "Database Judge",
        sections: [
          { speaker: "Teacher", text: "The 1MB document limit in Firestore is a wall for technical artifacts. Our 'Binary Chunking Protocol' (BCP) shards raw data into precisely 750,000-byte segments. This specific size accounts for the 33% overhead of Base64 encoding, ensuring every shard fits perfectly within a single document." },
          { speaker: "Student", text: "How do you handle audio logs?" },
          { speaker: "Teacher", text: "Look at the 'saveAudioToLedger' service. We write a parent Manifest Node that sequences these shards. During playback, the client-side engine parallel-fetches all fragments via HTTP/2 and stitches them using TypedArray.set() in memory. This achieves mass-agnostic latency: a 50MB log loads as fast as a 10KB script." }
        ]
      },
      "Offscreen Canvas Compositor Logic": {
        topic: "Offscreen Canvas Compositor Logic",
        professorName: "Visual Lead",
        studentName: "Auditor",
        sections: [
          { speaker: "Teacher", text: "Standard browser recording loses context when you switch tabs. The 'Scribe Protocol' solves this by generating a hidden 1920x1080 Compositor Canvas. We use a 30FPS loop to stitch the screen, a Gaussian-blurred backdrop, and a high-fidelity circular PIP camera portal." },
          { speaker: "Student", text: "What is the output format?" },
          { speaker: "Teacher", text: "We force an 8Mbps VP9 stream via the MediaRecorder API. This ensures that every line of code remains razor-sharp in the final 1080p artifact. These archives are then dispatched directly to the user's sovereign YouTube or Drive vault, ensuring the platform owner never touches the private engineering performance data." }
        ]
      },
      "High-DPI Rasterization Pipeline (400% Scale)": {
        topic: "High-DPI Rasterization Pipeline (400% Scale)",
        professorName: "Publishing Lead",
        studentName: "Judge",
        sections: [
          { speaker: "Teacher", text: "Technical publishing requires symbolic perfection. In the Author Studio and PdfSigner, we use a 4x rasterization pipeline. We render the UI to a hidden canvas at 400% scale before binding the PDF." },
          { speaker: "Student", text: "How do you handle complex math?" },
          { speaker: "Teacher", text: "We pre-process all LaTeX via KaTeX, converting them to high-resolution SVG masks within the synthesis stream. This ensures that a complex proof in a 50-page technical manual remains sharp even when zoomed 800% in the final PDF artifact. We have replaced blurry screenshots with deterministic symbolic flows." }
        ]
      },
      "Automatic TTS Failover Protocol": {
        topic: "Automatic TTS Failover Protocol",
        professorName: "Audio Systems Lead",
        studentName: "Judge",
        sections: [
          { speaker: "Teacher", text: "Operational continuity is a technical requirement. The 'Gemini 2.5 Flash TTS' engine is highly emotive but has strict throughput constraints. If a 429 'Too Many Requests' error is detected, our 'Failover Matrix' in tts.ts triggers immediately." },
          { speaker: "Student", text: "Where does it switch to?" },
          { speaker: "Teacher", text: "The engine handshakes with secondary high-fidelity providers like OpenAI or Google Cloud TTS. If all cloud spectrums are saturated, it refracts into 'Local Mode', utilizing the browser's native speech engine at $0 cost. This multi-layered resilience ensures that a Staff-level technical audit is never interrupted by cloud temporal physics." }
        ]
      },
      "Distributed Hardware Mesh": {
        topic: "Distributed Hardware Mesh",
        professorName: "2036 Visionary",
        studentName: "Resident",
        sections: [
          { speaker: "Teacher", text: "The final refraction of our architecture is the 10:1 Resident/Hub Ratio. We move from data center dependency to local sovereignty. One 'Optimus Hub'—a local supercomputer—serves 10 residents, acting as the primary Gemini reasoning node for the household." },
          { speaker: "Student", text: "Is this reflected in the dashboard?" },
          { speaker: "Teacher", text: "Yes. The 'Network Propagation' widget simulates the deployment of these hubs toward our goal of 1 billion nodes. If you look at the Dashboard now, you'll see our progress. We currently have over 122 million hubs active in the simulated mesh. This vision ensures that super-intelligence is a public utility, owned by the humans it serves." }
        ]
      }
    }
  }
};
