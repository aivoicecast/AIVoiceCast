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
            { id: 'jd-1-3', title: 'The 18x Efficiency Proof: KV Cache Math' }
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
        title: 'Sector 03: Thermodynamic Storage (BCP)', 
        subTopics: [
            { id: 'jd-3-1', title: 'Binary Chunking Protocol: 750,000 Byte Shards' },
            { id: 'jd-3-2', title: 'Serverless Choice: Why Firestore wins over SQL' }
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
      },
      { 
        id: 'judge-ch7', 
        title: 'Sector 07: The 8 Billion Humanity Goal', 
        subTopics: [
            { id: 'jd-7-1', title: 'Neural Lenses: Agent + Tool + Model Integration' }, 
            { id: 'jd-7-2', title: 'Earn/Spend 1.0: Zero-Cost Intelligence Economics' }
        ] 
      },
      { 
        id: 'judge-ch8', 
        title: 'Sector 08: The Dyad Pattern', 
        subTopics: [
            { id: 'jd-8-1', title: 'Lead-Shadow Orchestration' }, 
            { id: 'jd-8-2', title: 'Democratizing Dual-Model Applications' }
        ] 
      }
    ],
    lectures: {
      "The 18x Efficiency Proof: KV Cache Math": {
        topic: "The 18x Efficiency Proof: KV Cache Math",
        professorName: "Economic Architect",
        studentName: "Technical Auditor",
        sections: [
          { speaker: "Teacher", text: "Auditors often ask: why is the difference exactly 18x? It comes down to the physics of the KV Cache—the model's short-term memory. A 128k context requires roughly 150GB of RAM. A 2M context requires 2.4TB. That is a 16x jump in physical memory occupancy." },
          { speaker: "Student", text: "And where does the 18x come from?" },
          { speaker: "Teacher", text: "System overhead and bandwidth. Reading 2M tokens takes 18x more time-slices from the memory bandwidth than reading 128k. We call this the 'Hardware Hog' factor. One 2M query physically kicks out 18 other users. By using Gemini 3 Flash for the 128k window, we reach the Earn/Spend 1.0 goal." }
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
      },
      "Neural Lenses: Agent + Tool + Model Integration": {
          topic: "Neural Lenses: Agent + Tool + Model Integration",
          professorName: "Chief Architect",
          studentName: "Hackathon Auditor",
          sections: [
              { speaker: "Teacher", text: "In Sector 07, we define the 'Neural Lens.' It is the fundamental building block of our 8-billion-user vision. A Lens is an integrated circuit of intelligence combining a specialized Agent persona, MCP tools for data grounding, and the raw reasoning of Gemini." },
              { speaker: "Student", text: "And these Lenses are open-source?" },
              { speaker: "Teacher", text: "Exactly. Our mindset is one of radical transparency. We encourage everyone to clone our source and replicate our successes. When a Lens creates domain-specific content—like a study guide for kernel development—that content is shared among N members. This splits the model cost among the collective, making elite intelligence affordable for all of humanity." }
          ]
      },
      "Lead-Shadow Orchestration": {
          topic: "Lead-Shadow Orchestration",
          professorName: "Socratic Architect",
          studentName: "Technical Judge",
          sections: [
              { speaker: "Teacher", text: "In Sector 08, we reveal the 'Dyad Pattern.' We orchestrate a dual-model loop: Gemini 2.5 Flash Native Audio acts as the 'Lead Agent' for sub-200ms latency, while Gemini 3 Pro acts as the 'Shadow Agent' performing deep logic audits." },
              { speaker: "Student", text: "Can members build their own Dyad apps?" },
              { speaker: "Teacher", text: "Yes. Our platform democratizes this architecture. Any member can design a multi-model workflow—for example, a Tutor persona paired with a strict Grader auditor. This bypasses the 'agreeability' trap of standard AI and ensures a high-fidelity signal in any professional refraction." }
          ]
      }
    }
  }
};
