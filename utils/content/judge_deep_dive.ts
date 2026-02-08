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
            { id: 'jd-1-3', title: 'The 18x Capacity Multiplier' }
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
      "The 18x Capacity Multiplier": {
        topic: "The 18x Capacity Multiplier",
        professorName: "Economic Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Welcome to the economics of thermodynamics. By pushing users toward the 'Standard' 128k window of Gemini 3 Flash for most tasks, Google can support 18x more people on the same physical hardware compared to the 2-million-token Pro mode. In Neural Prism, we use this multiplier to reach the Earn/Spend 1.0 goal." },
          { speaker: "Student", text: "How does the community affect this?" },
          { speaker: "Teacher", text: "We deduplicate. If one user generates a technical Course or Scripture node and saves it to our Firebase ledger, and 100 others use that cached refraction, we save another 100x in cost. We encourage members to build their own lenses and share with the community, potentially dropping the cost of super-intelligence from $300/yr to almost zero." }
        ]
      },
      "Intelligence Routing Logic": {
        topic: "Intelligence Routing Logic",
        professorName: "Chief Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Welcome, Judge. Sector 01 examines our implementation of the 'Complexity Balancer v4'. In our source code, you'll see we perform a sub-millisecond triage of user intent: deep algorithmic reasoning is routed to 'gemini-3-pro-preview', while interactive simulations use 'gemini-3-flash-preview'. We achieve specialized behavior through deep system context rather than model fine-tuning." },
          { speaker: "Student", text: "Do you send the full simulation logs to the Pro model?" },
          { speaker: "Teacher", text: "Absolutely not. That would be thermodynamically irresponsible. Instead, we use the 'Vector Map Re-hydration' protocol. The Flash model generates a high-entropy vector map—a compressed fingerprint of the logic states—and only *that* is passed to Gemini 3 Pro for the final synthesis." }
        ]
      }
    }
  }
};
