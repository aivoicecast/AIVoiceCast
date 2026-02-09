import { GeneratedLecture } from '../types';

export const SYSTEM_AUDIT_NODES: GeneratedLecture[] = [
  {
    uid: 'audit-platform-000',
    topic: '0. Executive Summary: The v12.0 Paradigm',
    professorName: 'Lead Architect',
    studentName: 'Resident',
    sections: [],
    audit: {
      StructuralCoherenceScore: 100,
      LogicalDriftRisk: 'Low',
      AdversarialRobustness: 'High',
      coherenceScore: 100,
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: Date.now(),
      plantuml: "@startuml\npackage \"Grounding\" {\n  [GitHub Repository] as GH\n  [Google Search Tool] as GS\n}\npackage \"Generation\" {\n  [Gemini 3 Flash] as G3F\n  [Refraction Engine] as RE\n}\npackage \"Verification\" {\n  [Shadow Agent] as SA\n  [Neural Lens] as NL\n}\nGH -> GS : Source Truth\nGS -> SA : Grounding Context\nG3F -> RE : Outputs Logic\nRE -> SA : Request Audit\nSA -> NL : Verifies Mesh\nNL -> [Structural Coherence] : Compute Score\n@enduml",
      graph: {
        nodes: [
          { id: 'GH', label: 'GitHub Repository', type: 'component' },
          { id: 'GS', label: 'Google Search Tool', type: 'component' },
          { id: 'G3F', label: 'Gemini 3 Flash', type: 'component' },
          { id: 'RE', label: 'Refraction Engine', type: 'component' },
          { id: 'SA', label: 'Shadow Agent', type: 'component' },
          { id: 'NL', label: 'Neural Lens', type: 'component' },
          { id: 'SC', label: 'Structural Coherence', type: 'metric' }
        ],
        links: [
          { source: 'GH', target: 'GS', label: 'SOURCE_TRUTH' },
          { source: 'GS', target: 'SA', label: 'GROUNDING_CONTEXT' },
          { source: 'G3F', target: 'RE', label: 'OUTPUTS_LOGIC' },
          { source: 'RE', target: 'SA', label: 'REQUEST_AUDIT' },
          { source: 'SA', target: 'NL', label: 'VERIFIES_MESH' },
          { source: 'NL', target: 'SC', label: 'COMPUTE_SCORE' }
        ]
      },
      probes: [
        { question: "Is the GitHub link resolving for grounding?", answer: "Yes, the repository has been identified as the authoritative source for architectural verification.", status: 'passed' },
        { question: "Is the Harmony Ratio a fixed constant?", answer: "No, it is a dynamic thermodynamic measure of utility vs energy.", status: 'passed' }
      ]
    }
  },
  {
    uid: 'system-judge-audit-001',
    topic: '🏆 JUDGE: Technical Audit',
    professorName: 'Lead Architect',
    studentName: 'Hackathon Judge',
    sections: [],
    audit: {
      graph: {
        nodes: [
          { id: 'SCD', label: 'Shadow-Critic Dyad', type: 'component' },
          { id: 'BCP', label: 'BCP Protocol', type: 'component' },
          { id: 'HT', label: 'Heuristic Tracing', type: 'concept' },
          { id: '18X', label: '18x Efficiency Gap', type: 'metric' },
          { id: 'REG', label: 'Registry (Firebase)', type: 'component' },
          { id: 'VAU', label: 'Vault (Drive)', type: 'component' },
          { id: 'WRK', label: 'Workflow (GitHub)', type: 'component' },
          { id: 'H_RATIO', label: 'Harmony Ratio', type: 'metric' }
        ],
        links: [
          { source: 'SCD', target: 'HT', label: 'VERIFIES' },
          { source: '18X', target: 'SCD', label: 'ENABLES' },
          { source: 'REG', target: 'BCP', label: 'STORES_SHARDS' },
          { source: 'BCP', target: 'VAU', label: 'HYDRATES' },
          { source: 'WRK', target: 'HT', label: 'SOURCE_FOR' },
          { source: '18X', target: 'H_RATIO', label: 'MAXIMIZES' }
        ]
      },
      probes: [
        { 
          question: "How does the system handle the 1MB Firestore wall?", 
          answer: "We implemented the Binary Chunking Protocol (BCP), sharding data into 750KB deterministic segments.",
          status: 'passed'
        },
        { 
          question: "How is the 18x efficiency delta utilized?", 
          answer: "By routing 90% of multimodal interaction to Gemini Flash clusters (150GB VRAM) and reserving Thinking-enabled Pro models (2.4TB VRAM) for logic mesh verification.",
          status: 'passed'
        }
      ],
      coherenceScore: 100,
      StructuralCoherenceScore: 100,
      LogicalDriftRisk: 'Low',
      AdversarialRobustness: 'High',
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: Date.now(),
      plantuml: "@startuml\nnode \"Registry (Firebase)\" as R\nnode \"Vault (Drive)\" as V\nnode \"Workflow (GitHub)\" as W\ncomponent [Sovereign Silos] as SS\nSS ..> R\nSS ..> V\nSS ..> W\n@enduml"
    }
  }
];