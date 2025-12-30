
import { Notebook } from '../types';

export const MOCK_NOTEBOOKS: Notebook[] = [
  {
    id: 'nb-agentic-workflows',
    title: 'Agentic Workflows with Gemini 3.0',
    author: 'AIVoiceCast Research',
    description: 'An exploration into autonomous multi-step reasoning and tool-use patterns using the latest Gemini Pro models.',
    kernel: 'python',
    tags: ['AI Agents', 'Reasoning', 'Research'],
    createdAt: 1734000000000,
    updatedAt: 1734500000000,
    cells: [
      {
        id: 'c1',
        type: 'markdown',
        content: '# Research: Agentic Workflows\n\nTraditional LLM interaction is linear (input -> output). **Agentic Workflows** transition this to an iterative process where the model can use tools, reflect on its own output, and refine its strategy.\n\n### Key Concepts\n- **Tool-use (Function Calling)**: Giving the model "hands" to interact with the real world.\n- **Self-Correction**: Asking the model to critique its previous steps.\n- **Recursive Summarization**: Handling long context windows by compressing information.'
      },
      {
        id: 'c2',
        type: 'code',
        language: 'python',
        content: `def autonomous_agent_loop(goal, max_iterations=5):
    state = {"goal": goal, "history": [], "finished": False}
    
    for i in range(max_iterations):
        # 1. Think & Plan
        action = model.generate_action(state)
        
        # 2. Execute tool if needed
        if action.type == "TOOL_CALL":
            result = tools.execute(action.name, action.args)
            state["history"].append({"tool": action.name, "result": result})
        
        # 3. Check for completion
        if action.type == "FINAL_ANSWER":
            state["finished"] = True
            return action.text
            
    return "Agent timed out."`,
        output: "Agent initialized. Monitoring loop for Goal: 'Analyze OCI Networking latency'..."
      },
      {
        id: 'c3',
        type: 'markdown',
        content: '## Findings\nOur research suggests that breaking a complex task into a sequence of small, verifiable steps (The "ReAct" pattern) improves accuracy in technical tasks by over 40% compared to zero-shot prompting.'
      }
    ]
  },
  {
    id: 'nb-quantum-sim',
    title: 'Quantum Circuit Simulation in Python',
    author: 'Prof. Q',
    description: 'A tutorial on building and simulating basic quantum gates (Hadamard, CNOT) to demonstrate entanglement.',
    kernel: 'python',
    tags: ['Quantum Computing', 'Simulation', 'Tutorial'],
    createdAt: 1734100000000,
    updatedAt: 1734600000000,
    cells: [
      {
        id: 'q1',
        type: 'markdown',
        content: '# Tutorial: Quantum Entanglement\n\nQuantum entanglement is a physical phenomenon that occurs when a group of particles are generated, interact, or share spatial proximity in a way such that the quantum state of each particle cannot be described independently of the state of the others.\n\nIn this notebook, we simulate a **Bell State**.'
      },
      {
        id: 'q2',
        type: 'code',
        language: 'python',
        content: `from qiskit import QuantumCircuit, assemble, Aer
from qiskit.visualization import plot_histogram

# 1. Create a quantum circuit with 2 qubits
qc = QuantumCircuit(2)

# 2. Apply a Hadamard gate to qubit 0 (Superposition)
qc.h(0)

# 3. Apply a CNOT gate with control 0 and target 1 (Entanglement)
qc.cx(0, 1)

# 4. Measure both qubits
qc.measure_all()

# 5. Run on a simulator
sim = Aer.get_backend('qasm_simulator')
qobj = assemble(qc)
result = sim.run(qobj).result()

print("Measurement results:", result.get_counts())`,
        output: "Measurement results: {'00': 512, '11': 512}"
      },
      {
        id: 'q3',
        type: 'markdown',
        content: 'Observe that we only get `00` or `11`. The qubits are entangled! If you measure one as `0`, the other is guaranteed to be `0`.'
      }
    ]
  },
  {
    id: 'nb-rag-arch',
    title: 'Advanced RAG: From Vector to Graph',
    author: 'AI Architect',
    description: 'Moving beyond simple similarity search. We explore hybrid search, re-ranking, and the transition to Knowledge Graphs.',
    kernel: 'javascript',
    tags: ['RAG', 'Vector DB', 'Knowledge Graphs'],
    createdAt: 1734200000000,
    updatedAt: 1734700000000,
    cells: [
      {
        id: 'r1',
        type: 'markdown',
        content: '# Advanced RAG Architectures\n\nSimple RAG pipelines often fail because of **Semantic Chunking** issues or lost context. \n\n### The Hybrid Approach\nCombining Keyword (BM25) search with Vector (Dense) search allows for both precise term matching and conceptual understanding.'
      },
      {
        id: 'r2',
        type: 'code',
        language: 'javascript',
        content: `const hybridSearch = async (query, k = 5) => {
    // 1. Fetch dense results (Conceptual)
    const vectorResults = await vectorStore.similaritySearch(query, k);
    
    // 2. Fetch sparse results (Keyword)
    const keywordResults = await fullTextSearch.search(query, k);
    
    // 3. Reciprocal Rank Fusion (RRF)
    const fusedResults = rrf(vectorResults, keywordResults);
    
    // 4. Final Re-ranking with Cross-Encoder
    return await reranker.sort(query, fusedResults);
};`,
        output: "Search module loaded. Ready to process queries."
      }
    ]
  }
];
