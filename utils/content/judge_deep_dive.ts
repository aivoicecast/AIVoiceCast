import { SpotlightChannelData } from '../spotlightContent';

export const JUDGE_DEEP_DIVE_CONTENT: Record<string, SpotlightChannelData> = {
  'judge-deep-dive': {
    curriculum: [
      { 
        id: 'judge-ch1', 
        title: 'Sector 01: Multi-Model Orchestration & Thermodynamics', 
        subTopics: [
            { id: 'jd-1-1', title: 'Intelligence Routing Logic' }, 
            { id: 'jd-1-2', title: 'Complexity Balancer: Logic Gates' }
        ] 
      },
      { 
        id: 'judge-ch2', 
        title: 'Sector 02: Infrastructure-Bypass & Heuristic Simulation', 
        subTopics: [
            { id: 'jd-2-1', title: 'The Liars Computer: Predictive Execution' }, 
            { id: 'jd-2-2', title: 'Lifecycle Thermodynamics: Tokens vs Provisioning' },
            { id: 'jd-2-3', title: 'WASM & Native Execution Audit' }
        ] 
      },
      { 
        id: 'judge-ch3', 
        title: 'Sector 03: Sovereign Data Persistence (BCP)', 
        subTopics: [
            { id: 'jd-3-1', title: 'Binary Chunking Protocol Mechanics' }, 
            { id: 'jd-3-2', title: 'Latency Thermodynamics: DB vs Storage' }
        ] 
      },
      { 
        id: 'judge-ch4', 
        title: 'Sector 04: The Sovereign Bake & Trust Root', 
        subTopics: [
            { id: 'jd-4-1', title: 'Bit-Perfect Multi-Page Hash Parity' }, 
            { id: 'jd-4-2', title: 'Offline-Ready Handshake Logic' }
        ] 
      },
      { 
        id: 'judge-ch5', 
        title: 'Sector 05: Scribe Architecture & Frame-Flow', 
        subTopics: [
            { id: 'jd-5-1', title: 'The Hidden Canvas Compositor' }, 
            { id: 'jd-5-2', title: '8Mbps VP9 Activity Streaming' }
        ] 
      },
      { 
        id: 'judge-ch6', 
        title: 'Sector 06: Symbol Flow Integrity', 
        subTopics: [
            { id: 'jd-6-1', title: 'High-DPI Rasterization Pipeline' }, 
            { id: 'jd-6-2', title: 'Symbolic Math Parity (KaTeX)' }
        ] 
      },
      { 
        id: 'judge-ch7', 
        title: 'Sector 07: Drift Analytics & Cognitive Mapping', 
        subTopics: [
            { id: 'jd-7-1', title: 'Measuring Talent via Semantic Drift' }, 
            { id: 'jd-7-2', title: 'Alignment of Mental Models' }
        ] 
      },
      { 
        id: 'judge-ch8', 
        title: 'Sector 08: Sovereignty & Dispatch', 
        subTopics: [
            { id: 'jd-8-1', title: 'The Least-Privilege OAuth Handshake' }, 
            { id: 'jd-8-2', title: 'Bypassing Platform Intermediaries' }
        ] 
      },
      { 
        id: 'judge-ch9', 
        title: 'Sector 09: VoiceCoin Ledger & Decentralized ID', 
        subTopics: [
            { id: 'jd-9-1', title: 'ECDSA P-256 Identity Shards' }, 
            { id: 'jd-9-2', title: 'Trustless Financial Refraction' }
        ] 
      },
      { 
        id: 'judge-ch10', 
        title: 'Sector 10: 2026 Vision: Hybrid Physical Socraticism', 
        subTopics: [
            { id: 'jd-10-1', title: 'Deploying Logic to Humanoid Hardware' }, 
            { id: 'jd-10-2', title: 'The Hybrid Compute Strategy: V1 ACTIVE' }
        ] 
      }
    ],
    lectures: {
      "Intelligence Routing Logic": {
        topic: "Intelligence Routing Logic",
        professorName: "Chief Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Sector 01: Multi-Model Orchestration. We begin our audit with the fundamental shift in how super-intelligence is routed. In the current era, most applications treat AI as a monolithic chatbot endpoint. This is thermodynamically and cognitively inefficient. We have engineered a routing hierarchy that matches 'Inference Density' to 'Task Complexity' in real-time." },
          { speaker: "Student", text: "How does the system determine density without adding overhead latency to the request?" },
          { speaker: "Teacher", text: "We use a 'Pre-Refraction Intent Classifier.' Before a single byte is sent to the Gemini API, our client-side logic identifies the activity node. For this manifest, we utilize a 100% Gemini stack to maximize logical purity and eliminate 'Model Translation Decay.' However, our open-source architecture is built for total model-agnostic flexibility. We already demonstrate a hybrid design in the Audio Layer, allowing architects to toggle between four distinct TTS providers: Gemini Flash, Google Cloud, OpenAI, and Local System. Our platform is PWA-enabled for home-screen deployment. While currently cloud-orchestrated, the architecture is prepared for the next refraction: migrating high-frequency logic to on-device local models to achieve zero-latency physicality for humanoid hardware, as discussed in Sector 10." }
        ]
      },
      "Complexity Balancer: Logic Gates": {
        topic: "Complexity Balancer: Logic Gates",
        professorName: "Chief Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "The Complexity Balancer is the gatekeeper of our thermodynamic efficiency. It is an autonomous client-side router that determines which model in the Gemini family is best suited for the incoming activity request. Traditional apps are binary: they either use 'The AI' or they don't. We treat intelligence as a variable density." },
          { speaker: "Student", text: "What happens during a long session if the model context starts to drift or timeout?" },
          { speaker: "Teacher", text: "The Balancer manages 'Preemptive Rotation'. Because low-latency connections like the Live API have natural timeouts, the Balancer silently initiates a parallel handshake every 5 minutes. It transfers the active 'Neural Snapshot'—a compressed manifest of the user's cursor position, code deltas, and design doc state—to a fresh session before terminating the old one. The user never sees a 'Reconnecting...' spinner. The conversation never stutters. This is 'Always-On' super-intelligence." }
        ]
      },
      "The Liars Computer: Predictive Execution": {
        topic: "The Liars Computer: Predictive Execution",
        professorName: "Systems Engineer",
        studentName: "Cloud Auditor",
        sections: [
          { speaker: "Teacher", text: "Sector 02: Infrastructure-Bypass. Traditional cloud-based IDEs are throughput-optimized but carry significant boot overhead. Every 'Run' command triggers a physical cycle: provisioning a container, installing dependencies, and teardown. This adds human-time latency (the 'Wait Wall')." },
          { speaker: "Student", text: "If the code isn't actually running on a CPU, how can you guarantee the output is accurate for complex logic like recursion or memory pointers?" },
          { speaker: "Teacher", text: "We treat Gemini 3 Flash as a 'Digital Twin' of a POSIX-compliant machine for non-web languages like Python or C++. However, for JavaScript and TypeScript, we use the **Native Browser Runtime**. We aren't claiming simulation is a silver bullet; it's a tool in the hierarchy. We use simulation for the 'Soul' (architectural logic) and native silicon for the 'Structure' (execution)." }
        ]
      },
      "Lifecycle Thermodynamics: Tokens vs Provisioning": {
        topic: "Lifecycle Thermodynamics: Tokens vs Provisioning",
        professorName: "Chief Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "The 'Infrastructure Bypass' is an optimization of human flow. While physical containers consume energy to boot, LLMs consume energy to predict. We've audited the cost deltas." },
          { speaker: "Student", text: "Is simulating code with an LLM actually cheaper than running it natively?" },
          { speaker: "Teacher", text: "Not necessarily in terms of raw compute units. AI Simulation can cost $1.00 - $10.00 per 1,000 runs in tokens. WebAssembly and Native Browser execution, by contrast, is **$0.00** because the user provides the 'server' (their own laptop). The innovation here is the **Refractive Hierarchy**. We use Native silicon for the logic, and Neural silicon for the **Socratic Interface**. A native runtime just says 'Segmentation Fault'. Our simulated refraction says: 'I suspect a race condition in your thread pool logic.' You pay for the reasoning, not just the result." }
        ]
      },
      "WASM & Native Execution Audit": {
        topic: "WASM & Native Execution Audit",
        professorName: "Systems Architect",
        studentName: "Cloud Auditor",
        sections: [
          { speaker: "Teacher", text: "Adding WebAssembly and Native execution support for web-native languages was our primary priority. We've optimized the spectrum. For JavaScript/TypeScript, we use @swc/wasm-web for instant syntax checks and the browser's own V8 engine for execution. This is the bedrock of our 'Hybrid Strategy.' Local compute handles the syntax and execution for free, while the AI handles the Socratic Architectural Audit. This ensures the platform is financially sustainable at a massive scale." },
          { speaker: "Student", text: "How do you prove it's really running locally and not hitting an API?" },
          { speaker: "Teacher", text: "Check the **Neural Diagnostics Console**. We output a specific 'Rationale Trace' for every check and run. If it's JS/TS, you'll see the [LOCAL_WASM_TRANSPILE] and [NATIVE_RUNTIME] handshakes. It's 100% transparent." }
        ]
      },
      "The Hybrid Compute Strategy: V1 ACTIVE": {
        topic: "The Hybrid Compute Strategy: V1 ACTIVE",
        professorName: "Robotics Lead",
        studentName: "Judge",
        sections: [
          { speaker: "Teacher", text: "Sector 10: The Future. To further optimize costs while ensuring a Staff-level experience, we have successfully deployed the **Hybrid Compute Engine** in the Builder Studio." },
          { speaker: "Student", text: "Is it really live?" },
          { speaker: "Teacher", text: "Yes. The 'Check Syntax' and 'Run' buttons now trigger local browser silicon for JS/TS files. It performs a full AST-level audit on the user's device with 0ms network latency. This is 100% decoupled from any LLM API tokens. We reserve the expensive Gemini AI Simulation for non-web languages and high-level architectural interrogation. We have proven that a 100% Gemini stack can be hybridized with local compute to achieve architectural parity with native runtimes while maintaining sovereign privacy." }
        ]
      }
    }
  }
};