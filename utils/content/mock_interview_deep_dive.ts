import { SpotlightChannelData } from '../spotlightContent';

export const MOCK_INTERVIEW_DEEP_DIVE_CONTENT: Record<string, SpotlightChannelData> = {
  'mock-interview-deep-dive': {
    curriculum: [
      { 
        id: 'mi-aud-ch0', 
        title: 'Domain A: Philosophy of Technical Friction', 
        subTopics: [
            { id: 'mi-0-1', title: 'Sector 00: Pedagogical Friction vs. User Satisfaction' }, 
            { id: 'mi-0-2', title: 'Sector 01: The Probe-Wait Handshake' }
        ] 
      },
      { 
        id: 'mi-aud-ch1', 
        title: 'Domain B: Real-Time Multimodal Interaction', 
        subTopics: [
            { id: 'mi-1-1', title: 'Sector 02: Native Audio WebSocket (Emotive Link)' }, 
            { id: 'mi-1-2', title: 'Sector 03: Cursor & Focus Vector Synchronization' }
        ] 
      },
      { 
        id: 'mi-aud-ch2', 
        title: 'Domain C: Performance & Energy Thermodynamics', 
        subTopics: [
            { id: 'mi-2-1', title: 'Sector 04: Heuristic Execution: The Liars Computer' }, 
            { id: 'mi-2-2', title: 'Sector 05: Thermodynamic Efficiency: The 10x Saving' }
        ] 
      },
      { 
        id: 'mi-aud-ch3', 
        title: 'Domain D: Persistent Storage Protocols', 
        subTopics: [
            { id: 'mi-3-1', title: 'Sector 06: High-Fidelity Capture (Scribe)' }, 
            { id: 'mi-3-2', title: 'Sector 07: Binary Chunking: Bypassing the 1MB Wall' }
        ] 
      },
      { 
        id: 'mi-aud-ch4', 
        title: 'Domain E: Career Refraction Outcomes', 
        subTopics: [
            { id: 'mi-4-1', title: 'Sector 08: Cognitive Drift & Evaluation Strategy' }, 
            { id: 'mi-4-2', title: 'Sector 09: The 10-Week Recursive Curriculum' }
        ] 
      }
    ],
    lectures: {
      "Sector 00: Pedagogical Friction vs. User Satisfaction": {
        topic: "Pedagogical Friction vs. User Satisfaction",
        professorName: "Senior Staff Interrogator",
        studentName: "Technical Candidate",
        sections: [
          { speaker: "Teacher", text: "Welcome to Domain A. We begin with the 'Assistant Fallacy.' Most AI models are trained to be agreeable. They optimize for user satisfaction, often leading to a 'False Signal' in professional evaluation. We have engineered this studio for **Pedagogical Friction.** This is a deliberate design choice where the AI persona prioritizes logical purity over the candidate's comfort. We don't want you to feel good; we want you to be right. This friction is not arbitrary; it is the specific pressure needed to reveal 'Unknown Unknowns.' When you describe an architecture, the AI doesn't just nod along. It identifies the highest-entropy logic gate—the part of your plan most likely to fail—and demands a defense. This is 'Staff-Level' evaluation. It's the difference between a tutor and a peer auditor." }
        ]
      },
      "Sector 01: The Probe-Wait Handshake": {
        topic: "The Probe-Wait Handshake",
        professorName: "Socratic Architect",
        studentName: "Staff Candidate",
        sections: [
          { speaker: "Teacher", text: "The mechanics of friction are governed by the 'Probe-Wait Cycle.' When a candidate suggests an architectural plan, the AI persona identifies the highest-entropy logic gate. For example, if you mention a 'Distributed Database,' the AI immediately probes your understanding of the CAP Theorem. It then enters a 'Wait' state, measuring the candidate's first high-fidelity reasoning block. If the candidate provides a shallow response, the friction increases. This ensures that the evaluation is a real-time measure of technical authority, not just recall. We are looking for the 'Neural Density' of your engineering wisdom." }
        ]
      },
      "Sector 02: Native Audio WebSocket (Emotive Link)": {
        topic: "Native Audio WebSocket (Emotive Link)",
        professorName: "Audio Systems Lead",
        studentName: "Candidate",
        sections: [
          { speaker: "Teacher", text: "Domain B covers the Emotive Link. Latency is the enemy of natural technical dialogue. We have implemented a persistent WebSocket connection using the Gemini 2.5 Flash Native Audio core. By streaming raw PCM data directly to the model's multimodal input, we bypass the Text-to-Speech (TTS) and Speech-to-Text (STT) layers. This achieves sub-200ms verbal response times, enabling natural interruptions and micro-analysis of speech patterns—the tremors of uncertainty or long pauses that reveal conceptual gaps." }
        ]
      },
      "Sector 03: Cursor & Focus Vector Synchronization": {
        topic: "Cursor & Focus Vector Synchronization",
        professorName: "Visual Lead",
        studentName: "Developer",
        sections: [
          { speaker: "Teacher", text: "To evaluate engineering growth, we track the alignment of mind and hand. Every 200ms, the browser dispatches cursor coordinates and sparse text deltas to the neural host. The cursor acts as an 'Intent Vector.' If you are verbally explaining a load balancer while your cursor lingers on a database connection pool, the AI identifies a 'Focus Mismatch.' It knows you may be struggling to implement your mental model, and can interject Socratic feedback precisely where the implementation drift occurs." }
        ]
      },
      "Sector 04: Heuristic Execution: The Liars Computer": {
        topic: "Heuristic Execution: The Liars Computer",
        professorName: "Systems Architect",
        studentName: "Staff Candidate",
        sections: [
          { speaker: "Teacher", text: "Domain C: The Infrastructure Bypass. In our Builder Studio, we eliminate physical compilers. When you click 'Run,' we use **Heuristic Logic Tracing** via Gemini 3 Flash. The AI acts as a 'Digital Twin' of a terminal, 'imagining' the result of code execution with >98% accuracy. It tracks stack pointers and heap allocations in its context window. This zero-risk sandboxing allows candidates to explore high-risk logic—like race conditions—without touching a physical CPU. It transforms 'Compiling' from a wait wall into a moment of neural refraction." }
        ]
      },
      "Sector 05: Thermodynamic Efficiency: The 10x Saving": {
        topic: "Thermodynamic Efficiency: The 10x Saving",
        professorName: "Sustainability Architect",
        studentName: "Cloud Auditor",
        sections: [
          { speaker: "Teacher", text: "Physical containers are energy-expensive. Bypassing the boot, link, and teardown cycles of traditional cloud IDEs results in a 10x reduction in total operational wattage. We trade redundant physical computation for high-fidelity neural prediction. This 'Green Computing' strategy allows us to scale Staff-level evaluation to millions of users without destroying the power grid." }
        ]
      },
      "Sector 06: High-Fidelity Capture (Scribe)": {
        topic: "High-Fidelity Capture (Scribe)",
        professorName: "Visual Lead",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Domain D: Scribe Protocol. Standard recording fails when users switch tabs. Scribe bypasses this by rendering to a hidden 1920x1080 'Compositor Canvas' in memory. Our loop stitches the workspace, a circular PIP camera feed, and a Gaussian-blurred backdrop into a single high-fidelity artifact at 30FPS. This data is then dispatched directly to the user's sovereign YouTube vault, ensuring the candidate maintains 100% copyright and privacy of their professional record." }
        ]
      },
      "Sector 07: Binary Chunking: Bypassing the 1MB Wall": {
        topic: "Binary Chunking: Bypassing the 1MB Wall",
        professorName: "Cloud Architect",
        studentName: "Database Judge",
        sections: [
          { speaker: "Teacher", text: "Sector 07: Firestore enforces a strict 1MB document limit. High-fidelity neural audio logs and technical manuscripts frequently exceed this wall. Our **Binary Chunking Protocol (BCP)** shards raw binary data into 750,000-byte segments. While in-memory reconstruction is sub-150ms, total transit remains bound by network physics. This architecture ensures that a metadata ledger remains a reliable block storage system without sacrificing logic depth." }
        ]
      },
      "Sector 08: Cognitive Drift & Evaluation Strategy": {
        topic: "Cognitive Drift & Evaluation Strategy",
        professorName: "Senior Evaluator",
        studentName: "Candidate",
        sections: [
          { speaker: "Teacher", text: "Domain E addresses 'Architectural Drift.' We measure the delta between your verbal intent and your physical implementation. If you describe a lock-free queue but implement a standard mutex, the AI flags a cognitive gap. You understand the theory, but cannot yet refract it into implementation. This 'Deep Signal' is used to target the specific logical poles where your authority fails." }
        ]
      },
      "Sector 09: The 10-Week Recursive Curriculum": {
        topic: "The 10-Week Recursive Curriculum",
        professorName: "Chief Architect",
        studentName: "Engineer",
        sections: [
          { speaker: "Teacher", text: "The session ends with a personalized Refraction Plan. This is a technical artifact synthesized by Gemini 3 Pro after analyzing your performance. The plan is recursive: as you complete drills in the Studio, the AI monitors your drift metrics and adapts the curriculum. If you master a concept early, the system skips redundant content and pivots toward higher abstractions." }
        ]
      }
    }
  }
};
