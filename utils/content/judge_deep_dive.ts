import { SpotlightChannelData } from '../spotlightContent';

export const JUDGE_DEEP_DIVE_CONTENT: Record<string, SpotlightChannelData> = {
  'judge-deep-dive': {
    curriculum: [
      { 
        id: 'judge-ch1', 
        title: 'Sector 01-04: Foundations & Refraction', 
        subTopics: [
            { id: 'jd-1-1', title: 'The v12.9.5 Paradigm & Harmony Ratio' }, 
            { id: 'jd-1-2', title: 'Binary Chunking Protocol (BCP)' },
            { id: 'jd-1-3', title: 'Sovereign Silos & Independent Drives' },
            { id: 'jd-1-4', title: 'Case Study: Hallucinated Deletion' }
        ] 
      },
      { 
        id: 'judge-ch2', 
        title: 'Sector 05-08: Handshaking Logic', 
        subTopics: [
            { id: 'jd-2-1', title: 'The Grounding Bridge: Code as Truth' }, 
            { id: 'jd-2-2', title: 'Dyad Cycle: Generator vs Auditor' },
            { id: 'jd-2-3', title: 'Machine Interface Protocol (MIP)' },
            { id: 'jd-2-4', title: 'The 18x Scaling Advantage' }
        ] 
      },
      { 
        id: 'judge-ch3', 
        title: 'Sector 09-12: Observable Future', 
        subTopics: [
            { id: 'jd-3-1', title: 'Logic Mesh & Mermaid Instrumentation' }, 
            { id: 'jd-3-2', title: 'N-Factor Protocol Economics' },
            { id: 'jd-3-3', title: 'Thermodynamic Terminus: 10:1 Ratio' },
            { id: 'jd-3-4', title: 'Verifiable Reasoning Verification' }
        ] 
      }
    ],
    lectures: {
      "The v12.9.5 Paradigm & Harmony Ratio": {
        topic: "The v12.9.5 Paradigm & Harmony Ratio",
        professorName: "Chief Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Welcome to the v12.9.5 synthesis. We have moved from simple generation to Recursive Verified Intelligence. Our primary success metric is the Harmony Ratio (H), measuring utility produced versus thermal energy consumed. By routing 90% of logic to Gemini Flash clusters, we achieve an 18x efficiency gain over standard Pro-only deployments." },
          { speaker: "Student", text: "How is the Harmony Ratio calculated exactly in the Hub?" },
          { speaker: "Teacher", text: "It is the quotient of Functional Logical Mass divided by TPU Joules. In the old world, intelligence was blindsided by cost. Here, we drive marginal costs toward zero by sharding reasoning into a community ledger. The Hub is a thermodynamic re-alignment of human activity." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: 'H_RATIO', label: 'Harmony Ratio', type: 'metric' },
              { id: 'UTIL', label: 'Functional Mass', type: 'metric' },
              { id: 'TPU', label: 'Energy Cost', type: 'metric' },
              { id: 'FLA', label: 'Gemini Flash (90%)', type: 'component' }
            ],
            links: [
              { source: 'FLA', target: 'TPU', label: 'Minimizes' },
              { source: 'UTIL', target: 'H_RATIO', label: 'Numerator' },
              { source: 'TPU', target: 'H_RATIO', label: 'Denominator' }
            ]
          },
          probes: [
            { question: "What is the 18x scaling proof?", answer: "Based on VRAM occupancy deltas between 150GB Flash and 2.4TB Pro clusters.", status: 'passed' }
          ],
          coherenceScore: 100,
          StructuralCoherenceScore: 100,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: 1738224000000
        }
      },
      "Binary Chunking Protocol (BCP)": {
          topic: "Binary Chunking Protocol (BCP)",
          professorName: "Cloud Architect",
          studentName: "Technical Judge",
          sections: [
              { speaker: "Teacher", text: "Firestore is our control plane, but it has a 1MB document limit. To host 100MB neural audio logs, we implemented BCP v2." },
              { speaker: "Student", text: "How does the sharding logic handle rehydration latency?" },
              { speaker: "Teacher", text: "We shard raw binary into deterministic 750,000-byte segments. The client engine performs multiplexed rehydration, reaching 150ms re-assembly times. This bypasses the 'Cold Boot' penalty of traditional cloud storage for interactive media." }
          ],
          audit: {
              graph: {
                  nodes: [
                      { id: 'BCP', label: 'BCP Protocol', type: 'component' },
                      { id: 'SEG', label: '750KB Segments', type: 'metric' },
                      { id: 'FS', label: 'Firestore Ledger', type: 'component' }
                  ],
                  links: [
                      { source: 'BCP', target: 'SEG', label: 'Shards' },
                      { source: 'SEG', target: 'FS', label: 'Persistent in' }
                  ]
              },
              probes: [
                  { question: "Why 750KB and not 1MB?", answer: "To account for Firestore metadata overhead and base64 encoding expansion ratios.", status: 'passed' }
              ],
              coherenceScore: 100,
              StructuralCoherenceScore: 100,
              LogicalDriftRisk: 'Low',
              AdversarialRobustness: 'High',
              driftRisk: 'Low',
              robustness: 'High',
              timestamp: 1738224000000
          }
      },
      "Sovereign Silos & Independent Drives": {
          topic: "Sovereign Silos & Independent Drives",
          professorName: "Security Lead",
          studentName: "Technical Judge",
          sections: [
              { speaker: "Teacher", text: "To prevent state contamination, we utilize the Independent Drive Model. Metadata (Firestore), Artifacts (Google Drive), and Code (GitHub) are isolated." },
              { speaker: "Student", text: "What is the primary benefit of avoiding auto-sync between silos?" },
              { speaker: "Teacher", text: "Integrity. We use SHA-256 fingerprints in the metadata to point to artifacts. If Drive contaminated the Code silo, the 'Logical Chain' would break. Single-Source Ownership ensures the user remains the ultimate authority of their data." }
          ],
          audit: {
              graph: {
                  nodes: [
                      { id: 'SSO', label: 'Single-Source Ownership', type: 'concept' },
                      { id: 'VAU', label: 'Sovereign Vault', type: 'component' },
                      { id: 'WRK', label: 'GitHub Workflow', type: 'component' }
                  ],
                  links: [
                      { source: 'SSO', target: 'VAU', label: 'Governs' },
                      { source: 'SSO', target: 'WRK', label: 'Governs' }
                  ]
              },
              probes: [
                  { question: "Can the platform move funds without a user key?", answer: "No. ECDSA P-256 keys are stored device-local, ensuring zero-trust financial sovereignty.", status: 'passed' }
              ],
              coherenceScore: 98,
              StructuralCoherenceScore: 98,
              LogicalDriftRisk: 'Low',
              AdversarialRobustness: 'High',
              driftRisk: 'Low',
              robustness: 'High',
              timestamp: 1738224000000
          }
      },
      "Case Study: Hallucinated Deletion": {
          topic: "Case Study: Hallucinated Deletion",
          professorName: "Audit Lead",
          studentName: "Technical Judge",
          sections: [
              { speaker: "Teacher", text: "During v12 development, the model attempted to purge 500 lines of PDF code during a 'clean-up' task. We call this a logical drift event." },
              { speaker: "Student", text: "How did the Neural Lens identify this specific failure?" },
              { speaker: "Teacher", text: "Through Functional Mass Comparison. The Lens detected a sudden 40% drop in Cyclomatic Cognitive Complexity (CCC) that wasn't accompanied by a refactoring intent flag. The audit system automatically refused the commit." }
          ],
          audit: {
              graph: {
                  nodes: [
                      { id: 'FMC', label: 'Functional Mass Comp', type: 'component' },
                      { id: 'CCC', label: 'Complexity Metric', type: 'metric' },
                      { id: 'REF', label: 'Audit Refusal', type: 'concept' }
                  ],
                  links: [
                      { source: 'CCC', target: 'FMC', label: 'Input' },
                      { source: 'FMC', target: 'REF', label: 'Triggers' }
                  ]
              },
              probes: [
                  { question: "Does the system catch partial deletions?", answer: "Yes, any deviation in logical node density beyond a defined threshold triggers an invariant audit.", status: 'passed' }
              ],
              coherenceScore: 95,
              StructuralCoherenceScore: 95,
              LogicalDriftRisk: 'Low',
              AdversarialRobustness: 'High',
              driftRisk: 'Low',
              robustness: 'High',
              timestamp: 1738224000000
          }
      },
      "The Grounding Bridge: Code as Truth": {
        topic: "The Grounding Bridge: Code as Truth",
        professorName: "Truth Auditor",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "Hallucination is the death of technical authority. To solve this, we implemented the Grounding Bridge. In the reasoning layer, Gemini 3 Pro uses the googleSearch tool to crawl our official repository at github.com/aivoicecast/AIVoiceCast in real-time." },
          { speaker: "Student", text: "So the documentation and code are perfectly synced?" },
          { speaker: "Teacher", text: "Correct. During synthesis, the model doesn't just rely on training data. it performs a 'Source-of-Truth' lookup to verify that architectural claims—like our 750KB Binary Chunking—match the live implementation. This is verifiable parity." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: 'GRD', label: 'Grounding Bridge', type: 'concept' },
              { id: 'SRC', label: 'GitHub Source', type: 'component' },
              { id: 'GSH', label: 'googleSearch Tool', type: 'component' }
            ],
            links: [
              { source: 'GSH', target: 'SRC', label: 'Crawl' },
              { source: 'SRC', target: 'GRD', label: 'Validates' }
            ]
          },
          probes: [
            { question: "What repository is used for grounding?", answer: "The official GitHub AIVoiceCast/AIVoiceCast repository.", status: 'passed' }
          ],
          coherenceScore: 99,
          StructuralCoherenceScore: 99,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: 1738224000000
        }
      },
      "Dyad Cycle: Generator vs Auditor": {
        topic: "Dyad Cycle: Generator vs Auditor",
        professorName: "Socratic Architect",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "We treat super-intelligence as a self-correcting cycle. Tool A (Studio) generates code or logic, and Tool B (Lens) performs an immediate adversarial audit. This is the Dyad Cycle." },
          { speaker: "Student", text: "How do the tools communicate?" },
          { speaker: "Teacher", text: "Through the Machine Interface Protocol (MIP). We've embedded a machine-only language into our diagnostic console. Tool B extracts a logic mesh, finds contradictions, and injects structured feedback directly back into the Generator's context window." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: 'T_A', label: 'Generator (Studio)', type: 'component' },
              { id: 'T_B', label: 'Auditor (Lens)', type: 'component' },
              { id: 'MIP', label: 'Machine Interface', type: 'concept' }
            ],
            links: [
              { source: 'T_A', target: 'T_B', label: 'Output' },
              { source: 'T_B', target: 'MIP', label: 'Audit' },
              { source: 'MIP', target: 'T_A', label: 'Self-Correct' }
            ]
          },
          probes: [
            { question: "What is Agreeability Bias?", answer: "The tendency for AI to prioritize user comfort over logical purity; eliminated here via adversarial feedback.", status: 'passed' }
          ],
          coherenceScore: 98,
          StructuralCoherenceScore: 98,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: 1738224000000
        }
      },
      "Machine Interface Protocol (MIP)": {
          topic: "Machine Interface Protocol (MIP)",
          professorName: "Systems Architect",
          studentName: "Technical Judge",
          sections: [
              { speaker: "Teacher", text: "MIP is the 'Neural Backbone' for tool-to-tool orchestration. It standardizes how a fast model reporting an error talks to a slow model performing a fix." },
              { speaker: "Student", text: "Is it just JSON schema?" },
              { speaker: "Teacher", text: "No. It includes a logical 'Checksum' of the context. If Tool B's feedback doesn't match the SHA-256 of the active workspace, the handshake is rejected. This prevents out-of-sync logic from contaminating the VFS." }
          ],
          audit: {
              graph: {
                  nodes: [
                      { id: 'MIP', label: 'MIP v1.0', type: 'component' },
                      { id: 'CHK', label: 'Context Checksum', type: 'metric' },
                      { id: 'VFS', label: 'Workflow Silo', type: 'component' }
                  ],
                  links: [
                      { source: 'MIP', target: 'CHK', label: 'Validates' },
                      { source: 'CHK', target: 'VFS', label: 'Protects' }
                  ]
              },
              probes: [
                  { question: "How does MIP prevent race conditions?", answer: "By assigning atomic sequence IDs to every tool-to-tool handshake message.", status: 'passed' }
              ],
              coherenceScore: 100,
              StructuralCoherenceScore: 100,
              LogicalDriftRisk: 'Low',
              AdversarialRobustness: 'High',
              driftRisk: 'Low',
              robustness: 'High',
              timestamp: 1738224000000
          }
      },
      "The 18x Scaling Advantage": {
          topic: "The 18x Scaling Advantage",
          professorName: "Efficiency Lead",
          studentName: "Technical Judge",
          sections: [
              { speaker: "Teacher", text: "The economics of the Hub rely on routing. We route 90% of activity to Gemini 3 Flash to achieve an 18x scaling advantage." },
              { speaker: "Student", text: "18x based on what baseline?" },
              { speaker: "Teacher", text: "VRAM occupancy. A thinking-enabled Pro cluster occupies ~2.4TB of VRAM, while a Flash cluster handles similar throughput with only 150GB. This allows the Neural Prism to serve 18 times more concurrent users on the same hardware footprint." }
          ],
          audit: {
              graph: {
                  nodes: [
                      { id: 'VRAM', label: 'VRAM Occupancy', type: 'metric' },
                      { id: 'FLS', label: 'Flash Cluster', type: 'component' },
                      { id: 'PRO', label: 'Pro Cluster', type: 'component' }
                  ],
                  links: [
                      { source: 'FLS', target: 'VRAM', label: '150GB' },
                      { source: 'PRO', target: 'VRAM', label: '2.4TB' }
                  ]
              },
              probes: [
                  { question: "Why not use Pro for everything?", answer: "It violates the Harmony Ratio by consuming 18x more energy for tasks Flash can solve with 98% parity.", status: 'passed' }
              ],
              coherenceScore: 100,
              StructuralCoherenceScore: 100,
              LogicalDriftRisk: 'Low',
              AdversarialRobustness: 'High',
              driftRisk: 'Low',
              robustness: 'High',
              timestamp: 1738224000000
          }
      },
      "Logic Mesh & Mermaid Instrumentation": {
          topic: "Logic Mesh & Mermaid Instrumentation",
          professorName: "Visual Lead",
          studentName: "Technical Judge",
          sections: [
              { speaker: "Teacher", text: "We instrument reasoning using Mermaid.js graph structures. This provides a formal, machine-readable logic substrate for every refraction." },
              { speaker: "Student", text: "Why Mermaid specifically over other visualization formats?" },
              { speaker: "Teacher", text: "Token density. Mermaid is strictly text-based and follows a predictable syntax. This allows Gemini to generate 'Visual Logic' with near-zero syntax drift, ensuring the Hub remains observable for judges and architects." }
          ],
          audit: {
              graph: {
                  nodes: [
                      { id: 'MER', label: 'Mermaid.js', type: 'component' },
                      { id: 'TD', label: 'Graph TD', type: 'concept' },
                      { id: 'OBS', label: 'Observability', type: 'concept' }
                  ],
                  links: [
                      { source: 'MER', target: 'TD', label: 'Visualizes' },
                      { source: 'TD', target: 'OBS', label: 'Enables' }
                  ]
              },
              probes: [
                  { question: "How are node IDs handled?", answer: "Strict single-word alphanumeric identifiers to prevent Mermaid parser syntax breaches.", status: 'passed' }
              ],
              coherenceScore: 98,
              StructuralCoherenceScore: 98,
              LogicalDriftRisk: 'Low',
              AdversarialRobustness: 'High',
              driftRisk: 'Low',
              robustness: 'High',
              timestamp: 1738224000000
          }
      },
      "N-Factor Protocol Economics": {
          topic: "N-Factor Protocol Economics",
          professorName: "Economic Architect",
          studentName: "Technical Judge",
          sections: [
              { speaker: "Teacher", text: "N-Factor allows us to scale logic to zero marginal cost. Refactor Once, Share N Times." },
              { speaker: "Student", text: "What happens when N reaches 10,000?" },
              { speaker: "Teacher", text: "The compute tax for a Staff-level technical problem drops to less than $0.03. We are moving from a 'Usage-Tax' model to a 'Registry-Utility' model where knowledge is a community asset." }
          ],
          audit: {
              graph: {
                  nodes: [
                      { id: 'NF', label: 'N-Factor', type: 'concept' },
                      { id: 'C_REG', label: 'Community Registry', type: 'component' },
                      { id: 'COST', label: 'Marginal Cost', type: 'metric' }
                  ],
                  links: [
                      { source: 'NF', target: 'C_REG', label: 'Leverages' },
                      { source: 'C_REG', target: 'COST', label: 'Reduces' }
                  ]
              },
              probes: [
                  { question: "How is the cache validated?", answer: "Via SHA-256 fingerprinting of the input prompt context.", status: 'passed' }
              ],
              coherenceScore: 100,
              StructuralCoherenceScore: 100,
              LogicalDriftRisk: 'Low',
              AdversarialRobustness: 'High',
              driftRisk: 'Low',
              robustness: 'High',
              timestamp: 1738224000000
          }
      },
      "Thermodynamic Terminus: 10:1 Ratio": {
        topic: "Thermodynamic Terminus: 10:1 Ratio",
        professorName: "Vision Lead",
        studentName: "Technical Judge",
        sections: [
          { speaker: "Teacher", text: "The terminus of the Neural Prism is the 10:1 Resident to Hub ratio. We are preparing for 2036. Each Hub provides survival thermodynamics—power, heat, and logic—for ten family units." },
          { speaker: "Student", text: "What hardware supports this at the edge?" },
          { speaker: "Teacher", text: "450kWh Battery Planes providing 72 hours of complete sovereignty. We drive the 'Joy Dividend' by collapsing the 40-hour work week into half a day. Intelligence becomes a public utility, free at the point of use, governed by the community ledger." }
        ],
        audit: {
          graph: {
            nodes: [
              { id: 'HUB', label: 'Optimus Hub', type: 'component' },
              { id: 'RES', label: '10 Residents', type: 'metric' },
              { id: 'JOY', label: 'Joy Dividend', type: 'concept' },
              { id: 'BAT', label: '450kWh Battery', type: 'metric' }
            ],
            links: [
              { source: 'HUB', target: 'RES', label: 'Serves' },
              { source: 'HUB', target: 'JOY', label: 'Enables' },
              { source: 'BAT', target: 'HUB', label: 'Powers' }
            ]
          },
          probes: [
            { question: "What is the Charity Handshake?", answer: "One full day dedicated to contributing logic back into the global mesh to fund collective abundance.", status: 'passed' }
          ],
          coherenceScore: 100,
          StructuralCoherenceScore: 100,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: 1738224000000
        }
      },
      "Verifiable Reasoning Verification": {
          topic: "Verifiable Reasoning Verification",
          professorName: "Security Architect",
          studentName: "Technical Judge",
          sections: [
              { speaker: "Teacher", text: "Final sector: VPR. Every reasoning pass is signed by the user's on-device private key." },
              { speaker: "Student", text: "How do you verify a thought was authentically generated by the model?" },
              { speaker: "Teacher", text: "We embed the model's self-audit into a signed Notary Shard. This binds the 'Reasoning Graph' to the user's identity on the ledger. It is the ultimate defense against synthetic logic injection." }
          ],
          audit: {
              graph: {
                  nodes: [
                      { id: 'VPR', label: 'Verifiable Reasoning', type: 'concept' },
                      { id: 'SIG', label: 'P-256 Signature', type: 'component' },
                      { id: 'NOT', label: 'Notary Shard', type: 'component' }
                  ],
                  links: [
                      { source: 'VPR', target: 'SIG', label: 'Requires' },
                      { source: 'SIG', target: 'NOT', label: 'Manifests' }
                  ]
              },
              probes: [
                  { question: "Is the private key shared?", answer: "No. ECDSA P-256 keys never leave the hardware cell, satisfying the Sovereignty Axiom.", status: 'passed' }
              ],
              coherenceScore: 100,
              StructuralCoherenceScore: 100,
              LogicalDriftRisk: 'Low',
              AdversarialRobustness: 'High',
              driftRisk: 'Low',
              robustness: 'High',
              timestamp: 1738224000000
          }
      }
    }
  }
};