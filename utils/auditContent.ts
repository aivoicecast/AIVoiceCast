
import { GeneratedLecture } from '../types';

export const SYSTEM_AUDIT_NODES: GeneratedLecture[] = [
  {
    uid: 'audit-platform-000',
    topic: '0. Executive Summary: The v12.0 Paradigm',
    professorName: 'Lead Architect',
    studentName: 'Resident',
    sections: [],
    audit: {
      StructuralCoherenceScore: 98,
      LogicalDriftRisk: 'Low',
      AdversarialRobustness: 'High',
      coherenceScore: 98,
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: Date.now(),
      plantuml: "@startuml\npackage \"Generation\" {\n  [Gemini 3 Flash] as G3F\n  [Refraction Engine] as RE\n}\npackage \"Verification\" {\n  [Shadow Agent] as SA\n  [Neural Lens] as NL\n}\nG3F -> RE : Outputs Logic\nRE -> SA : Request Audit\nSA -> NL : Verifies Mesh\nNL -> [Structural Coherence] : Compute Score\n@enduml",
      graph: {
        nodes: [
          { id: 'g3f', label: 'Gemini 3 Flash', type: 'component' },
          { id: 'sa', label: 'Shadow Agent', type: 'component' },
          { id: 'hr', label: 'Harmony Ratio', type: 'metric' }
        ],
        links: [
          { source: 'g3f', target: 'sa', label: 'Audited By' }
        ]
      },
      probes: [
        { question: "Is the Harmony Ratio a fixed constant?", answer: "No, it is a dynamic thermodynamic measure of utility vs energy.", status: 'passed' }
      ]
    }
  },
  {
    uid: 'audit-platform-006',
    topic: '6. The Logic Mesh: PlantUML Instrumentation',
    professorName: 'Instrumentation Lead',
    studentName: 'Auditor',
    sections: [],
    audit: {
      StructuralCoherenceScore: 99,
      LogicalDriftRisk: 'Low',
      AdversarialRobustness: 'High',
      coherenceScore: 99,
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: Date.now(),
      plantuml: "@startuml\npackage \"Observability\" {\n  component [PlantUML Encoder] as PE\n  component [Deflate Stream] as DS\n}\npackage \"Metrics\" {\n  queue [Coherence Score] as CS\n  queue [Drift Risk] as DR\n}\n[Gemini 3 Pro] -> PE : Logic Shards\nPE -> DS : Raw String\nDS -> [UI Renderer] : Encoded URI\n[Audit Logic] -> CS : Validates Cycles\n[Audit Logic] -> DR : Checks Orphans\n@enduml",
      graph: {
        nodes: [
          { id: 'puml', label: 'PlantUML Encoder', type: 'component' },
          { id: 'cs', label: 'Coherence Score', type: 'metric' },
          { id: 'mesh', label: 'Logic Mesh', type: 'concept' }
        ],
        links: [
          { source: 'puml', target: 'mesh', label: 'Visualizes' },
          { source: 'mesh', target: 'cs', label: 'Inputs to' }
        ]
      },
      probes: [
        { question: "How are disconnected nodes penalized?", answer: "A 3-point penalty is applied per orphaned conceptual node.", status: 'passed' }
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
          { id: '1', label: 'Shadow-Critic Dyad', type: 'component' },
          { id: '2', label: 'BCP Protocol', type: 'component' },
          { id: '3', label: 'Heuristic Tracing', type: 'concept' },
          { id: '4', label: '18x Efficiency Gap', type: 'metric' }
        ],
        links: [
          { source: '1', target: '3', label: 'Verifies' },
          { source: '4', target: '1', label: 'Enables' }
        ]
      },
      probes: [
        { 
          question: "How does the system handle the 1MB Firestore wall?", 
          answer: "We implemented the Binary Chunking Protocol (BCP), sharding data into 750KB deterministic segments.",
          status: 'passed'
        },
        { 
          question: "What prevents 'Silent Drift'?", 
          answer: "The Neural Lens performs recursive re-derivation checks, comparing outputs against a global structural invariant.",
          status: 'passed'
        }
      ],
      coherenceScore: 99,
      StructuralCoherenceScore: 99,
      LogicalDriftRisk: 'Low',
      AdversarialRobustness: 'High',
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: 1738252800000,
      plantuml: "@startuml\nnode \"Registry (Firebase)\" as R\nnode \"Vault (Drive)\" as V\nnode \"Workflow (GitHub)\" as W\n[Sovereign Silos] ..> R\n[Sovereign Silos] ..> V\n[Sovereign Silos] ..> W\n@enduml"
    }
  },
  {
    uid: 'system-gemini-audit-001',
    topic: '🤖 CHANNEL: Google AI Studio - Gemini 3',
    professorName: 'DevRel Auditor',
    studentName: 'Integrator',
    sections: [],
    audit: {
      graph: {
        nodes: [
          { id: '1', label: 'Native Multimodality', type: 'concept' },
          { id: '2', label: 'Live API WebSocket', type: 'component' },
          { id: '3', label: 'Context Caching', type: 'metric' },
          { id: '4', label: 'Thinking Budget', type: 'metric' }
        ],
        links: [
          { source: '2', target: '1', label: 'Streams' },
          { source: '3', target: '2', label: 'Optimizes' }
        ]
      },
      probes: [
        { 
          question: "How is interruption handled in the Live API?", 
          answer: "The system monitors the 'interrupted' signal from the serverContent and immediately clears the local AudioContext buffer queue.",
          status: 'passed'
        }
      ],
      coherenceScore: 97,
      StructuralCoherenceScore: 97,
      LogicalDriftRisk: 'Low',
      AdversarialRobustness: 'High',
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: 1738253200000
    }
  }
];
