
import { GeneratedLecture } from '../types';

export const SYSTEM_AUDIT_NODES: GeneratedLecture[] = [
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
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: 1738252800000
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
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: 1738253200000
    }
  },
  {
    uid: 'system-db-audit-001',
    topic: '🗄️ CHANNEL: Schema at Scale - The F1 Blueprint',
    professorName: 'DB Internalist',
    studentName: 'Architect',
    sections: [],
    audit: {
      graph: {
        nodes: [
          { id: '1', label: 'Spanner/F1 Blueprint', type: 'concept' },
          { id: '2', label: 'Distributed Transactions', type: 'concept' },
          { id: '3', label: 'TrueTime Uncertainty', type: 'metric' }
        ],
        links: [
          { source: '3', target: '1', label: 'Bounds' }
        ]
      },
      probes: [
        { 
          question: "How does F1 handle schema changes?", 
          answer: "It uses a multi-phase lease protocol to ensure no two nodes have conflicting views.",
          status: 'passed'
        }
      ],
      coherenceScore: 98,
      driftRisk: 'Low',
      robustness: 'Medium',
      timestamp: 1738253300000
    }
  },
  {
    uid: 'system-linux-audit-001',
    topic: '🐧 CHANNEL: Linux Kernel Architect',
    professorName: 'Kernel Maintainer',
    studentName: 'Systems Dev',
    sections: [],
    audit: {
      graph: {
        nodes: [
          { id: '1', label: 'CFS Scheduler', type: 'component' },
          { id: '2', label: 'vruntime', type: 'metric' },
          { id: '3', label: 'Red-Black Tree', type: 'component' }
        ],
        links: [
          { source: '3', target: '1', label: 'Underlies' }
        ]
      },
      probes: [
        { 
          question: "Complexity of picking next task?", 
          answer: "O(1) via the leftmost node of the Red-Black tree.",
          status: 'passed'
        }
      ],
      coherenceScore: 99,
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: 1738253400000
    }
  },
  {
    uid: 'system-interview-audit-001',
    topic: '🛡️ AUDIT: DyadAI Studio (Software Interview)',
    professorName: 'Interviewer Auditor',
    studentName: 'Recruiter',
    sections: [],
    audit: {
      graph: {
        nodes: [
          { id: '1', label: 'Socratic Friction', type: 'concept' },
          { id: '2', label: 'Lead-Shadow Dyad', type: 'component' },
          { id: '3', label: 'Evaluation Synthesis', type: 'metric' }
        ],
        links: [
          { source: '2', target: '1', label: 'Implements' }
        ]
      },
      probes: [
        { 
          question: "What is the Shadow Whisper?", 
          answer: "A sub-100ms course correction instruction sent from the Auditor to the Interaction layer.",
          status: 'passed'
        }
      ],
      coherenceScore: 95,
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: 1738253500000
    }
  },
  {
    uid: 'system-guide-audit-001',
    topic: '🌈 GUIDE: Neural Prism Platform',
    professorName: 'System Architect',
    studentName: 'Resident',
    sections: [],
    audit: {
      graph: {
        nodes: [
          { id: '1', label: 'Infrastructure-Bypass', type: 'concept' },
          { id: '2', label: 'VFS Layer', type: 'component' },
          { id: '3', label: '10:1 Scaling Ratio', type: 'metric' }
        ],
        links: [
          { source: '2', target: '1', label: 'Enables' }
        ]
      },
      probes: [
        { 
          question: "How is code executed?", 
          answer: "Through Heuristic Logic Tracing in Gemini 3 Flash, imagining the terminal output.",
          status: 'passed'
        }
      ],
      coherenceScore: 96,
      driftRisk: 'Low',
      robustness: 'Medium',
      timestamp: 1738253600000
    }
  },
  {
    uid: 'system-bible-audit-001',
    topic: '📖 SCRIPTURE: Neural Sanctuary',
    professorName: 'Linguistic Auditor',
    studentName: 'Researcher',
    sections: [],
    audit: {
      graph: {
        nodes: [
          { id: '1', label: 'Bilingual Mapping', type: 'concept' },
          { id: '2', label: 'Deep Hydration', type: 'component' },
          { id: '3', label: 'Cinema Refraction', type: 'component' },
          { id: '4', label: 'Verse-Sync Hash', type: 'metric' }
        ],
        links: [
          { source: '2', target: '1', label: 'Populates' },
          { source: '4', target: '2', label: 'Validates' },
          { source: '3', target: '1', label: 'Visualizes' }
        ]
      },
      probes: [
        { 
          question: "How is verse synchronization maintained?", 
          answer: "We use a Global Audio Owner token and a Shared Cursor locking language shards to a timestamped event bus.",
          status: 'passed'
        }
      ],
      coherenceScore: 98,
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: 1738253100000
    }
  },
  {
    uid: 'system-book-audit-001',
    topic: '📑 BOOK: Architectural Truth',
    professorName: 'Neural Auditor',
    studentName: 'Reader',
    sections: [],
    audit: {
      graph: {
        nodes: [
          { id: '1', label: 'Instrumentation', type: 'component' },
          { id: '2', label: 'Structural Consistency', type: 'concept' },
          { id: '3', label: 'KV Cache Math', type: 'metric' }
        ],
        links: [
          { source: '1', target: '2', label: 'Ensures' },
          { source: '3', target: '1', label: 'Funds' }
        ]
      },
      probes: [
        { 
          question: "Does the manifest address the 18x efficiency gap?", 
          answer: "Yes, Chapter 1 details the RAM occupancy delta justifying the routing logic.",
          status: 'passed'
        }
      ],
      coherenceScore: 96,
      driftRisk: 'Low',
      robustness: 'Medium',
      timestamp: 1738252900000
    }
  },
  {
    uid: 'system-podcast-audit-001',
    topic: '🎙️ PODCAST: Judge Deep Dive',
    professorName: 'Socratic Auditor',
    studentName: 'Judge',
    sections: [],
    audit: {
      graph: {
        nodes: [
          { id: '1', label: 'Reasoning Observability', type: 'concept' },
          { id: '2', label: 'Shadow Agent', type: 'component' },
          { id: '3', label: 'Deduplication', type: 'component' }
        ],
        links: [
          { source: '2', target: '1', label: 'Monitors' },
          { source: '3', target: '2', label: 'Scales' }
        ]
      },
      probes: [
        { 
          question: "Is the Shadow Agent pattern real-time?", 
          answer: "Yes, Sector 03 of the audio dialogue confirms it operates with a 2M token window.",
          status: 'passed'
        }
      ],
      coherenceScore: 97,
      driftRisk: 'Low',
      robustness: 'High',
      timestamp: 1738253000000
    }
  }
];
