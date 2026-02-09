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
          timestamp: Date.now()
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
          timestamp: Date.now()
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
          timestamp: Date.now()
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
          timestamp: Date.now()
        }
      }
    }
  }
};