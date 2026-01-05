import { Notebook } from '../types';

export const MOCK_NOTEBOOKS: Notebook[] = [
  {
    id: 'nb-agentic-workflows',
    title: 'Self-Correction & Agentic Loops',
    author: 'AIVoiceCast Research',
    description: 'An exploration into autonomous multi-step reasoning. In this lab, we test how Gemini 3 models can reflect on their own logic to minimize hallucinations.',
    kernel: 'python',
    tags: ['AI Agents', 'Reasoning', 'Reflexion'],
    createdAt: 1734000000000,
    updatedAt: Date.now(),
    cells: [
      {
        id: 'c1',
        type: 'markdown',
        content: '# Research: The Reflexion Pattern\n\nTraditional LLM interaction is linear (input -> output). **Agentic Loops** introduce a "Reflection" step where the output is fed back to the model with a critique prompt.\n\n### Lab Goal\nDemonstrate a self-correcting logic loop for generating complex data structures.'
      },
      {
        id: 'c2',
        type: 'code',
        language: 'python',
        content: `PROMPT:
Generate a Python class for a thread-safe Singleton database connection pool. 
Then, analyze your own code for potential race conditions and provide a "Version 2" that fixes any identified issues.`,
        output: ""
      },
      {
        id: 'c3',
        type: 'markdown',
        content: '## Observation\nWhen executing the cell above, notice how the model performs a "step-back" reasoning task before providing the final architecture. This significantly reduces singleton-pattern errors common in standard zero-shot prompts.'
      }
    ]
  },
  {
    id: 'nb-oci-net',
    title: 'OCI Acceleron Performance Lab',
    author: 'Systems Architect',
    description: 'Investigating the performance characteristics of multiplanar scale-out fabrics in Oracle Cloud Infrastructure (OCI).',
    kernel: 'python',
    tags: ['Networking', 'Cloud', 'OCI'],
    createdAt: 1734100000000,
    updatedAt: Date.now(),
    cells: [
      {
        id: 'o1',
        type: 'markdown',
        content: '# OCI Acceleron Analysis\n\nWe are looking at the RoCEv2 implementation in the latest X9 instances.\n\n### Variables\n- Fabric: dedicated 1.6Tbps\n- Latency target: < 1.5μs'
      },
      {
        id: 'o2',
        type: 'code',
        language: 'python',
        content: `Compare the "dedicated fabric" approach of Oracle Acceleron vs AWS Nitro. 
Focus on All-Reduce synchronization overhead for 1,024 GPU clusters.
Summarize the findings in a technical table.`,
        output: ""
      },
      {
        id: 'o3',
        type: 'markdown',
        content: '### Preliminary Findings\nThe lack of noisy neighbors in the dedicated fabric leads to a deterministic tail latency (P99) that is 3x more stable than shared VPC fabrics.'
      }
    ]
  }
];