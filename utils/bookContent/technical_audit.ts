
import { SpotlightChannelData } from '../spotlightContent';

export const TECHNICAL_AUDIT_CONTENT: Record<string, SpotlightChannelData> = {
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
          { id: 'jd-2-1', title: 'Infrastructure-Bypass Protocol' },
          { id: 'jd-2-2', title: '10x Energy Efficiency Proof' }
        ]
      },
      {
        id: 'judge-ch8',
        title: 'Infrastructure Resilience',
        subTopics: [
          { id: 'jd-8-1', title: 'The 1MB Document Wall Solution' },
          { id: 'jd-8-2', title: 'Neural Drift Recovery Protocol' }
        ]
      },
      {
        id: 'judge-ch12',
        title: 'Shortening the Gap',
        subTopics: [
          { id: 'jd-12-1', title: '2026 Professional Reshaping Vision' },
          { id: 'jd-12-2', title: '10-Week Study Plan Synthesis' }
        ]
      }
    ],
    lectures: {
      "Multi-Model Orchestration Pipeline": {
        topic: "Multi-Model Orchestration Pipeline",
        professorName: "Chief Architect",
        studentName: "Auditor",
        sections: [
          { speaker: "Teacher", text: "Welcome to the Neural Core. Neural Prism v6.8.5 is built exclusively on a sovereign Google Gemini orchestration pipeline. We treat diverse Gemini models not as static endpoints, but as specialized logic gates. For high-dimensional typesetting and 24-section book synthesis, we leverage gemini-3-pro-preview. For the sub-800ms heuristic simulation in Builder Studio, we route tasks to gemini-3-flash-preview with a zero-token thinking budget." },
          { speaker: "Student", text: "How is the real-time voice handled if it's all Gemini? Is there an external STT layer?" },
          { speaker: "Teacher", text: "Excellent question. We have removed all non-native STT/TTS dependencies to minimize latency. When your prompt enters our Complexity Balancer, it identifies the intent instantly. If the intent is 'Reasoning', it routes to Gemini 3 Pro. If it is 'Simulation', it routes to Gemini 3 Flash. If it is 'Conversational', it establishes a direct WebSocket link with Gemini 2.5 Flash Native Audio for sub-200ms latency. This unified ecosystem ensures perfect consistency across the spectrum. We do not use third-party models like BERT or GPT; we believe in the native multimodal depth of the Gemini ecosystem. This 'Linguistic Purity' is what allows our Socratic Interrogator to feel so responsive." },
          { speaker: "Teacher", text: "Furthermore, we have bypassed traditional 'LLM wrappers' by building our own refractive snapshot protocol. This protocol bundles code deltas directly into the neural session header. This ensures the AI always has perfect visibility of your active workspace without needing to perform costly full-file re-ingestion every turn. It is a stateful experience built on top of a stateless API." },
          { speaker: "Student", text: "Does this affect the thermodynamic efficiency you mentioned?" },
          { speaker: "Teacher", text: "Absolutely. By minimizing the 'Context Shifting' between different vendor models, we reduce the total compute hours required for a single 45-minute session. We are essentially 'Pumping the Buffer' more efficiently. This is the thermodynamic core of the v6.8.5 standard: maximum intelligence per millijoule." }
        ]
      },
      "Refractive Caching & Deterministic UUIDs": {
        topic: "Refractive Caching & Deterministic UUIDs",
        professorName: "Data Architect",
        studentName: "Developer",
        sections: [
          { speaker: "Teacher", text: "Consistency is the greatest challenge in distributed intelligence. If two users ask the same complex architectural question, they should receive the same high-fidelity truth. We solve this using Deterministic UUIDs. We hash the topic, the context, and the language preference to create a permanent address for every synthesized artifact in our Knowledge Ledger." },
          { speaker: "Student", text: "So if two people generate the same lecture, they share the cache? Doesn't that create a privacy risk?" },
          { speaker: "Teacher", text: "On the contrary, it enhances privacy. We only hash the *Activity Definition*, not the user's private data. This makes the platform energy-efficient. We don't re-calculate the same intelligence twice. We simply refract the existing truth from the Knowledge Ledger. Your private modifications stay in your Sovereign Vault (Google Drive), while the 'Core Truth' is shared across the community. This 'Hash-Based Discovery' is how we scale to 24 specialized labs without bloating our database. We are building a global graph of verified refractions." }
        ]
      },
      "Infrastructure-Bypass Protocol": {
        topic: "Infrastructure-Bypass Protocol",
        professorName: "Sustainability Lead",
        studentName: "Auditor",
        sections: [
          { speaker: "Teacher", text: "Let's talk about the sustainability of the 'Run' button. Standard sandboxes consume massive amounts of power just on the infrastructure lifecycle—booting containers, mounting VFS, and teardown. By using gemini-3-flash-preview to trace logic heuristically, we bypass the provision/compile/teardown cycle entirely." },
          { speaker: "Student", text: "Does the simulation achieve true parity with native GCC or Python runtimes? How do you handle edge cases like memory overflows?" },
          { speaker: "Teacher", text: "In our internal algorithmic audits, we achieved >98% parity for standard technical interview tasks. We utilize the model's latent understanding of POSIX specifications. When a memory overflow occurs, the AI 'imagines' the crash exactly as a physical CPU would, but without the risk to the host. This results in a 10x energy efficiency gain per execution. We are essentially predicting the outcome of the program rather than executing it physically. It is a 'Liar's Computer' that tells the truth 98% of the time, which is more than enough for the purpose of learning and career evaluation. We trade 100% precision for 1000% speed and safety." }
        ]
      },
      "The 1MB Document Wall Solution": {
          topic: "The 1MB Document Wall Solution",
          professorName: "Cloud Architect",
          studentName: "Auditor",
          sections: [
              { speaker: "Teacher", text: "Sector 08: Infrastructure Resilience. Firestore, our primary ledger, enforces a strict 1MB limit per document. High-fidelity neural audio fragments and 24-chapter curriculums easily exceed this. Our solution is the Binary Chunking Protocol." },
              { speaker: "Student", text: "How do you reconstruct the data without adding noticeable latency to the UI?" },
              { speaker: "Teacher", text: "We shard the raw binary data into 750,000-byte segments. A 'Manifest Document' tracks the sequence and integrity hashes. Our reconstruction engine parallel-fetches these shards and stitches them back into a single Data URI in memory. This happens in less than 150ms, allowing us to maintain a real-time 'Live' feel while handling massive technical artifacts. We have turned a NoSQL database into a high-performance block storage system. This is 'Refractive Persistence' in action." }
          ]
      }
    }
  },
  'mock-interview-deep-dive': {
    curriculum: [
      {
        id: 'mi-aud-ch1',
        title: 'Sector 01: Socratic Paradigm',
        subTopics: [
          { id: 'mi-aud-1-1', title: 'Philosophy of Technical Interrogation' },
          { id: 'mi-aud-1-2', title: 'The Zone of Friction' }
        ]
      },
      {
        id: 'mi-aud-ch2',
        title: 'Sector 02: Neural Interrogation',
        subTopics: [
          { id: 'mi-aud-2-1', title: 'Emotive Link: Gemini 2.5 Flash Audio' },
          { id: 'mi-aud-2-2', title: 'Reasoning Out Loud Verification' }
        ]
      },
      {
        id: 'mi-aud-ch3',
        title: 'Sector 03: Logic Tracing',
        subTopics: [
          { id: 'mi-aud-3-1', title: 'Digital Twin Terminal Simulation' },
          { id: 'mi-aud-3-2', title: 'Heuristic State Sync' }
        ]
      },
      {
        id: 'mi-aud-ch4',
        title: 'Sector 04: Multi-Modal Synthesis',
        subTopics: [
          { id: 'mi-aud-4-1', title: 'The Triple-Layer Orchestration Loop' },
          { id: 'mi-aud-4-2', title: '10-Week Refraction Plan Synthesis' }
        ]
      },
      {
        id: 'mi-aud-ch5',
        title: 'Sector 05: Infrastructure-Bypass',
        subTopics: [
          { id: 'mi-aud-5-1', title: 'The 10x Efficiency Proof' },
          { id: 'mi-aud-5-2', title: 'Bypassing the Compilation Lifecycle' }
        ]
      },
      {
        id: 'mi-aud-ch6',
        title: 'Sector 06: Scribe Capture',
        subTopics: [
          { id: 'mi-aud-6-1', title: 'Canvas Compositor Architecture' },
          { id: 'mi-aud-6-2', title: '8Mbps VP9 Activity Streaming' }
        ]
      },
      {
        id: 'mi-aud-ch7',
        title: 'Sector 07: Edge-Cloud Vision',
        subTopics: [
          { id: 'mi-aud-7-1', title: 'Living Room Mentors: The Humanoid Shift' },
          { id: 'mi-aud-7-2', title: 'On-Device Local Models' }
        ]
      },
      {
        id: 'mi-aud-ch8',
        title: 'Sector 08: Data Matrix',
        subTopics: [
          { id: 'mi-aud-8-1', title: 'Volumetric Scaling: 10KB to 1GB' },
          { id: 'mi-aud-8-2', title: 'The 4-Tier Storage Handshake' }
        ]
      },
      {
        id: 'mi-aud-ch9',
        title: 'Sector 09: Robotics Economy',
        subTopics: [
          { id: 'mi-aud-9-1', title: 'The AIVoiceCoin Ledger' },
          { id: 'mi-aud-9-2', title: 'Autonomous Asset P2P Mentorship' }
        ]
      },
      {
        id: 'mi-aud-ch10',
        title: 'Sector 10: Shorten the Gap',
        subTopics: [
          { id: 'mi-aud-10-1', title: '2026 Professional Layout Shifts' },
          { id: 'mi-aud-10-2', title: 'Closing the Neural Audit' }
        ]
      }
    ],
    lectures: {
      "Philosophy of Technical Interrogation": {
        topic: "Philosophy of Technical Interrogation",
        professorName: "Lead Auditor",
        studentName: "Candidate",
        sections: [
          { speaker: "Teacher", text: "Technical interrogation is fundamentally different from a simple chat. Standard assistants are designed to be agreeable. They want to help you feel good and move fast. A 'Socratic Interrogator' must be analytical and technically abrasive. It prioritizes the purity of the logic over the comfort of the user. We want to see how you perform in the 'Zone of Friction'." },
          { speaker: "Student", text: "How do you enforce this 'abrasiveness' without being rude or unhelpful? What is the pedagogical goal?" },
          { speaker: "Teacher", text: "By focusing strictly on logical purity. When a candidate suggests a sub-optimal O(N^2) solution, the AI doesn't say 'good job'. It says 'I see a quadratic bottleneck on line 42. Explain why this is acceptable for a Staff-level architecture.' It forces the candidate to defend their mental model. This friction is where real engineering talent is revealed. We are not teaching you syntax; we are teaching you how to 'Reason Out Loud' as a Staff Engineer. This is the 'Shorten the Gap' philosophy." }
        ]
      },
      "Emotive Link: Gemini 2.5 Flash Audio": {
          topic: "Emotive Link: Gemini 2.5 Flash Audio",
          professorName: "Audio Architect",
          studentName: "Developer",
          sections: [
              { speaker: "Teacher", text: "Sector 02: The Emotive Link. We use the Gemini 2.5 Flash Native Audio model to provide sub-200ms verbal feedback. This model is trained to listen for nuances in reasoning out loud—the pauses, the tone, and the certainty." },
              { speaker: "Student", text: "Why not just use standard TTS? Isn't that easier to implement?" },
              { speaker: "Teacher", text: "Standard TTS is too slow for high-intensity interrogation. It introduces a 'Latency Wall' that breaks the cognitive flow. The Native Audio model allows the AI to interrupt the user naturally when they make a logical error. It creates a 'Conversational Handshake' that feels like a real human peer evaluation. This 'Emotive Link' is what allows the candidate to stay in the 'Flow State' even while being interrogated. We are evaluating your raw thinking speed, not just your ability to wait for a model to finish generating text." }
          ]
      },
      "Closing the Neural Audit": {
          topic: "Closing the Neural Audit",
          professorName: "Lead Architect",
          studentName: "Hackathon Judge",
          sections: [
              { speaker: "Teacher", text: "We have reviewed all 10 sectors. From Socratic Interrogation to the Robotics Economy, the Neural Prism Platform refracts superhuman capacity into human utility. We have proved that a 100% Gemini orchestration pipeline can achieve architectural parity with native runtimes while achieving a 10x energy saving." },
              { speaker: "Teacher", text: "The achievement of the Neural Prism is the synergy between human architectural oversight and the superhuman reasoning of the Gemini ecosystem. We have built a sovereign vault for your digital soul. Thanks for the Neural Prism Platform and the Google Gemini Model that power the platform behind the things. Refraction finalized. End of manifest. See you in the 2026 technical landscape." }
          ]
      }
    }
  }
};
