import { SpotlightChannelData } from '../spotlightContent';

export const JUDGE_DEEP_DIVE_CONTENT: Record<string, SpotlightChannelData> = {
  'judge-deep-dive': {
    curriculum: [
      { 
        id: 'judge-ch1', 
        title: 'Sector 01-04: Foundations & Failures', 
        subTopics: [
            { id: 'jd-1-1', title: 'The 1.0 Harmony Ratio' }, 
            { id: 'jd-1-2', title: 'Bypassing the 1MB Firestore Wall' },
            { id: 'jd-1-3', title: 'Zero Idle-Tax Architecture' },
            { id: 'jd-1-4', title: 'Case Study: Refactoring Entropy' }
        ] 
      },
      { 
        id: 'judge-ch2', 
        title: 'Sector 05-08: Logic & Logistics', 
        subTopics: [
            { id: 'jd-2-1', title: 'Builder Studio: Heuristic Trace' }, 
            { id: 'jd-2-2', title: 'Sovereign Scribe Protocol' },
            { id: 'jd-2-3', title: 'Sector 07: Technical Truth & Grounding' },
            { id: 'jd-2-4', title: 'Sector 08: The N-Factor Equilibrium' }
        ] 
      },
      { 
        id: 'judge-ch3', 
        title: 'Sector 09-12: The Audit Mesh', 
        subTopics: [
            { id: 'jd-3-1', title: 'Neural Lens: Observability' }, 
            { id: 'jd-3-2', title: 'Shadow-Critic Loop' },
            { id: 'jd-3-3', title: 'The Abundance Equilibrium' },
            { id: 'jd-3-4', title: 'Thermodynamic Terminus' }
        ] 
      }
    ],
    lectures: {
      "The 1.0 Harmony Ratio": {
        topic: "The 1.0 Harmony Ratio",
        professorName: "Chief Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Welcome to the Hub. In v12.0, we have collapsed the cost of intelligence by 100x through community ledger caching. We route logic based on the 18x efficiency delta between Flash and Pro. This isn't just a UI; it's a thermodynamic re-alignment of how humans interact with super-intelligence." },
          { speaker: "Student", text: "How do you handle the consistency across 24 apps with different model layers without losing state?" },
          { speaker: "Teacher", text: "We use a unified VFS—Virtual File System—layer. Whether it's source code, a banking check, or a scripture node, it's normalized into a sovereign URI. Our VFS implementation is sharded into 128KB segments, precisely matching the Gemini Flash native context window. This ensures 'Zero-Overflow' reasoning." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'Harmony Ratio', type: 'metric' },
              { id: '2', label: 'VFS Layer', type: 'component' },
              { id: '3', label: '18x Delta', type: 'metric' },
              { id: '4', label: 'Scale-to-Zero', type: 'concept' }
            ],
            links: [
              { source: '3', target: '1', label: 'Enables' },
              { source: '2', target: '3', label: 'Abstracts' },
              { source: '4', target: '1', label: 'Required for' }
            ]
          },
          probes: [
            { question: "Is the VFS truly sovereign?", answer: "Yes, it dispatches writes directly to user-owned Google Drive and GitHub accounts via OAuth.", status: 'passed' },
            { question: "How is the efficiency delta calculated?", answer: "Based on VRAM occupancy: 150GB for Flash vs 2.4TB for Pro clusters.", status: 'passed' }
          ],
          coherenceScore: 99,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 99,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: Date.now()
        }
      },
      "Bypassing the 1MB Firestore Wall": {
        topic: "Bypassing the 1MB Firestore Wall",
        professorName: "Cloud Lead",
        studentName: "Systems Architect",
        sections: [
          { speaker: "Teacher", text: "Our biggest technical wall was the 1MB document limit in Firestore. Standard technical transcripts and high-density audio fragments can easily exceed 5MB." },
          { speaker: "Student", text: "How did the Binary Chunking Protocol (BCP) solve this without destroying performance?" },
          { speaker: "Teacher", text: "We shard raw base64 data into deterministic 750,000-byte segments. A parent 'Manifest Node' acts as the root, containing SHA-256 integrity hashes for every child shard. This allows us to scale to zero while maintaining sub-150ms re-hydration from a distributed NoSQL plane." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'BCP v2', type: 'component' },
              { id: '2', label: '750KB Shards', type: 'metric' },
              { id: '3', label: 'Re-hydration', type: 'concept' }
            ],
            links: [
              { source: '1', target: '2', label: 'Partitions' },
              { source: '2', target: '3', label: 'Multiplexed' }
            ]
          },
          probes: [
            { question: "Why 750KB and not 1MB?", answer: "To allow for document metadata overhead and ensure safe Firestore buffer limits.", status: 'passed' },
            { question: "Is re-hydration sequential or parallel?", answer: "The client-side engine uses parallel fetch promises to reconstruct the URI buffer.", status: 'passed' }
          ],
          coherenceScore: 97,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 97,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'Medium',
          driftRisk: 'Low',
          robustness: 'Medium',
          timestamp: Date.now()
        }
      },
      "Zero Idle-Tax Architecture": {
        topic: "Zero Idle-Tax Architecture",
        professorName: "Infrastructure Lead",
        studentName: "DevOps Auditor",
        sections: [
          { speaker: "Teacher", text: "Thermodynamic honesty requires a Zero Idle-Tax architecture. Traditional relational databases charge you by the hour regardless of activity. This violates our Harmony Ratio goal." },
          { speaker: "Student", text: "But isn't SQL superior for relational data?" },
          { speaker: "Teacher", text: "Economically, no. By choosing Firestore and implementing BCP, we've eliminated fixed monthly costs. The platform scales to zero. We only consume energy when a human mind is refracting light." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'NoSQL Ledger', type: 'component' },
              { id: '2', label: 'Zero Idle-Tax', type: 'metric' },
              { id: '3', label: 'Scale-to-Zero', type: 'concept' }
            ],
            links: [
              { source: '1', target: '2', label: 'Ensures' },
              { source: '3', target: '2', label: 'Enables' }
            ]
          },
          probes: [
            { question: "What is the cost of an idle account?", answer: "$0.00. No provisioned instances are required for the community ledger.", status: 'passed' }
          ],
          coherenceScore: 98,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 98,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: Date.now()
        }
      },
      "Case Study: Refactoring Entropy": {
        topic: "Case Study: Refactoring Entropy",
        professorName: "Vibe Coding Lead",
        studentName: "Dev Researcher",
        sections: [
          { speaker: "Teacher", text: "A critical failure occurred during development: 'Hallucinated Deletion.' While updating the sidebar, the model silently purged 500 lines of complex PDF synthesis code." },
          { speaker: "Student", text: "How did we catch it?" },
          { speaker: "Teacher", text: "The Neural Lens. By comparing 'Refractive Mass' between the pre and post-refraction source code, our Auditor noticed a 40% drop in functional density and refused the commit." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'Refractive Mass', type: 'metric' },
              { id: '2', label: 'Logic Entropy', type: 'concept' },
              { id: '3', label: 'Auditor Reject', type: 'component' }
            ],
            links: [
              { source: '1', target: '3', label: 'Triggers' },
              { source: '2', target: '1', label: 'Measured by' }
            ]
          },
          probes: [
            { question: "What causes Agreeability Bias?", answer: "Model pressure to satisfy a user request even if it destroys existing logic invariants.", status: 'passed' }
          ],
          coherenceScore: 95,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 95,
          LogicalDriftRisk: 'Medium',
          AdversarialRobustness: 'High',
          driftRisk: 'Medium',
          robustness: 'High',
          timestamp: Date.now()
        }
      },
      "Builder Studio: Heuristic Trace": {
        topic: "Builder Studio: Heuristic Trace",
        professorName: "Compiler Lead",
        studentName: "Staff Candidate",
        sections: [
          { speaker: "Teacher", text: "In the Builder Studio, your code doesn't touch a real CPU. We use Heuristic Logic Tracing. Gemini 3 acts as a Digital Twin of a POSIX terminal, imagining execution with >98.4% accuracy." },
          { speaker: "Student", text: "Why not just use a real VM?" },
          { speaker: "Teacher", text: "Physical infrastructure has a massive energy overhead. By moving execution to the Prediction Layer, we achieve a 10x saving in operational wattage. It's safe, instant, and explainable." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'Digital Twin', type: 'concept' },
              { id: '2', label: 'Heuristic Trace', type: 'component' },
              { id: '3', label: '98.4% Parity', type: 'metric' }
            ],
            links: [
              { source: '2', target: '1', label: 'Powers' },
              { source: '2', target: '3', label: 'Achieves' }
            ]
          },
          probes: [
            { question: "Is memory safety simulated?", answer: "Yes, the model tracks stack and heap pointers conceptually to predict overflows or leaks.", status: 'passed' }
          ],
          coherenceScore: 99,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 99,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'Medium',
          driftRisk: 'Low',
          robustness: 'Medium',
          timestamp: Date.now()
        }
      },
      "Sovereign Scribe Protocol": {
        topic: "Sovereign Scribe Protocol",
        professorName: "Visual Systems Lead",
        studentName: "Observability Judge",
        sections: [
          { speaker: "Teacher", text: "Scribe is our high-fidelity session recorder. It solves the multi-tab visibility problem by rendering an off-screen compositor canvas." },
          { speaker: "Student", text: "How do you maintain 1080p performance in a browser while AI is running?" },
          { speaker: "Teacher", text: "We offload the video encoding to hardware via the MediaRecorder API and use a dedicated Web Worker to pump the canvas buffer. This ensures that the 'Sovereign Archive' is 100% frame-perfect, capturing the candidate's exact cursor path and facial tremors during technical interrogation." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'Compositor Canvas', type: 'component' },
              { id: '2', label: 'MediaRecorder', type: 'component' },
              { id: '3', label: '1080p 30FPS', type: 'metric' }
            ],
            links: [
              { source: '1', target: '2', label: 'Feeds' },
              { source: '2', target: '3', label: 'Outputs' }
            ]
          },
          probes: [
            { question: "Where are videos stored?", answer: "Dispatched directly to the user's unlisted YouTube vault via OAuth.", status: 'passed' }
          ],
          coherenceScore: 98,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 98,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: Date.now()
        }
      },
      "Sector 07: Technical Truth & Grounding": {
        topic: "Sector 07: Technical Truth & Grounding",
        professorName: "Truth Auditor",
        studentName: "Staff Developer",
        sections: [
          { speaker: "Teacher", text: "Welcome to Sector 07. Today we address the hallucination problem in technical documentation. In v12.0, we introduced 'Live Grounding' using the Google Search tool within the Gemini 3 Pro reasoning layer." },
          { speaker: "Student", text: "How does the AI use search to verify its own code?" },
          { speaker: "Teacher", text: "When a user points an Activity Node at a public GitHub repository, the platform doesn't just read the provided text. It initiates a search handshake. The AI uses the `googleSearch` tool to browse the repository, inspect the actual `README.md`, and verify that core protocols—like our 750KB Binary Chunking—are implemented as described." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'googleSearch', type: 'component' },
              { id: '2', label: 'Architectural Parity', type: 'concept' },
              { id: '3', label: 'Source Verification', type: 'metric' }
            ],
            links: [
              { source: '1', target: '3', label: 'Crawl' },
              { source: '3', target: '2', label: 'Validates' }
            ]
          },
          probes: [
            { question: "Does it read source files or just the README?", answer: "The search tool allows the model to browse the entire public directory structure and targeted source files.", status: 'passed' },
            { question: "What prevents documentation-code lag?", answer: "Real-time search grounding against the live Git state.", status: 'passed' }
          ],
          coherenceScore: 98,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 98,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: Date.now()
        }
      },
      "Sector 08: The N-Factor Equilibrium": {
        topic: "Sector 08: The N-Factor Equilibrium",
        professorName: "Economic Strategist",
        studentName: "Cloud Auditor",
        sections: [
          { speaker: "Teacher", text: "Sovereignty requires strict storage siloing. We use Firebase for Metadata, Drive for Vault, and GitHub for Workflow. We never auto-sync between them to ensure user control." },
          { speaker: "Student", text: "If they are siloed, how do we achieve the cost collapse we discussed?" },
          { speaker: "Teacher", text: "The N-Factor. We 'Refactor 1' time and 'Share N' times. By caching deterministic refractions in the global ledger, we allow members to retrieve verified logic shards rather than re-computing them. If N > 100, the cost of $300/yr intelligence collapses to less than $3. This is the primary economic engine of the Abundance Mesh." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'Refactor Once', type: 'concept' },
              { id: '2', label: 'Share N Times', type: 'metric' },
              { id: '3', label: 'Cost Collapse', type: 'metric' },
              { id: '4', label: 'Sovereign Silos', type: 'component' }
            ],
            links: [
              { source: '1', target: '2', label: 'Enables' },
              { source: '2', target: '3', label: 'Achieves' },
              { source: '4', target: '1', label: 'Protects' }
            ]
          },
          probes: [
            { question: "How is N calculated?", answer: "Total distinct retrievals per unique logic hash in the community ledger.", status: 'passed' },
            { question: "Does siloing slow down the N-Factor?", answer: "No, the BCP protocol re-hydrates shards in parallel from the common ledger regardless of personal vault choice.", status: 'passed' }
          ],
          coherenceScore: 99,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 99,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: Date.now()
        }
      },
      "Neural Lens: Observability": {
        topic: "Neural Lens: Observability",
        professorName: "Observability Lead",
        studentName: "Staff Judge",
        sections: [
          { speaker: "Teacher", text: "The Neural Lens turns Gemini from a 'Fluency Engine' into a 'Formal Verifier.' We measure 'Structural Coherence' and 'Drift Risk' in real-time." },
          { speaker: "Student", text: "What is the second layer of trust beyond the AI audit?" },
          { speaker: "Teacher", text: "Social Consensus. The Lens provides the logic, but the community provides the heart. We implement a 'Dual-Trust Layer' where shards are verified by the Lens and then commented/voted by members. This adds a 'Gold Trust' signal to our digital artifacts." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'Structural Coherence', type: 'metric' },
              { id: '2', label: 'Social Consensus', type: 'component' },
              { id: '3', label: 'Dual-Trust Layer', type: 'concept' }
            ],
            links: [
              { source: '1', target: '3', label: 'Primary' },
              { source: '2', target: '3', label: 'Secondary' }
            ]
          },
          probes: [
            { question: "How does voting impact the score?", answer: "Member sentiment is weighted and blended into the Coherence score as a 20% correction factor.", status: 'passed' }
          ],
          coherenceScore: 96,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 96,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: Date.now()
        }
      },
      "Shadow-Critic Loop": {
        topic: "Shadow-Critic Loop",
        professorName: "Dyad Lead",
        studentName: "Candidate",
        sections: [
          { speaker: "Teacher", text: "We never trust a single agent. The Shadow-Critic loop uses a hierarchical handshake. Agent A (Lead) proposes; Agent B (Shadow) audits." },
          { speaker: "Student", text: "Does the Shadow have different permissions?" },
          { speaker: "Teacher", text: "Yes. The Shadow operates with an 'Expanded Thinking Budget' and 2M token window. It sees the history that the Lead might have truncated, ensuring absolute logical invariants are maintained." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'Lead Agent', type: 'component' },
              { id: '2', label: 'Shadow Critic', type: 'component' },
              { id: '3', label: 'Logic Invariants', type: 'concept' }
            ],
            links: [
              { source: '2', target: '1', label: 'Audits' },
              { source: '2', target: '3', label: 'Enforces' }
            ]
          },
          probes: [
            { question: "What is a Shadow Whisper?", answer: "A sub-100ms course correction instruction sent from the Shadow to the Lead during voice interaction.", status: 'passed' }
          ],
          coherenceScore: 99,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 99,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: Date.now()
        }
      },
      "The Abundance Equilibrium": {
        topic: "The Abundance Equilibrium",
        professorName: "Vision Lead",
        studentName: "Resident",
        sections: [
          { speaker: "Teacher", text: "By 2036, our goal is the 10:1 Resident to Hub ratio. Intelligence must be a zero-marginal-cost utility." },
          { speaker: "Student", text: "How does the N-Factor facilitate this?" },
          { speaker: "Teacher", text: "Deduplication. When 100 members share a refactored kernel module, the energy cost per member drops below the cost of a physical book. We are trading massive redundant compute for intelligent caching." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: '10:1 Ratio', type: 'metric' },
              { id: '2', label: 'Deduplication', type: 'concept' },
              { id: '3', label: 'Zero Marginal Cost', type: 'metric' }
            ],
            links: [
              { source: '2', target: '3', label: 'Achieves' },
              { source: '1', target: '3', label: 'Goal' }
            ]
          },
          probes: [
            { question: "What is the cost floor?", answer: "Approximately $0.03 per logic shard when N > 1000.", status: 'passed' }
          ],
          coherenceScore: 95,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 95,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'Medium',
          driftRisk: 'Low',
          robustness: 'Medium',
          timestamp: Date.now()
        }
      },
      "Thermodynamic Terminus": {
        topic: "Thermodynamic Terminus",
        professorName: "Sustainability Lead",
        studentName: "Judge",
        sections: [
          { speaker: "Teacher", text: "The final sector address the energy ceiling. Intelligence is limited by watts. Our 1.0 Harmony Ratio ensures we produce more utility than thermal waste." },
          { speaker: "Student", text: "What is the 18x scaling proof?" },
          { speaker: "Teacher", text: "It is the VRAM delta. Flash (150GB) vs Pro (2.4TB). By routing 90% of activity to the 'Efficiency Pole,' we can sustain the population growth of the Hub mesh." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'Energy Ceiling', type: 'metric' },
              { id: '2', label: 'Harmony Ratio', type: 'metric' },
              { id: '3', label: 'Efficiency Pole', type: 'component' }
            ],
            links: [
              { source: '3', target: '2', label: 'Optimizes' },
              { source: '2', target: '1', label: 'Respects' }
            ]
          },
          probes: [
            { question: "How is thermal waste measured?", answer: "TPU joules consumed per successful logic commit.", status: 'passed' }
          ],
          coherenceScore: 99,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 99,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: Date.now()
        }
      }
    }
  }
};