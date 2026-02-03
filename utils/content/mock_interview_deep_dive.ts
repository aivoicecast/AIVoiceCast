
import { SpotlightChannelData } from '../spotlightContent';

export const MOCK_INTERVIEW_DEEP_DIVE_CONTENT: Record<string, SpotlightChannelData> = {
  'mock-interview-deep-dive': {
    curriculum: [
      { id: 'mi-aud-ch1', title: 'Sector 01: Socratic Paradigm', subTopics: [{ id: 'mi-aud-1-1', title: 'Pedagogical Friction Design' }, { id: 'mi-aud-1-2', title: 'The Probe-Wait Cycle' }] },
      { id: 'mi-aud-ch2', title: 'Sector 02: Neural Interrogation', subTopics: [{ id: 'mi-aud-2-1', title: 'Phase-Alignment of Audio Streams' }, { id: 'mi-aud-2-2', title: 'Nuance Jitter Detection' }] },
      { id: 'mi-aud-ch3', title: 'Sector 03: Logic Tracing', subTopics: [{ id: 'mi-aud-3-1', title: 'Memory Address Space Emulation' }, { id: 'mi-aud-3-2', title: 'Deterministic Prediction Bounds' }] },
      { id: 'mi-aud-ch4', title: 'Sector 04: Multi-Modal Interleaving', subTopics: [{ id: 'mi-aud-4-1', title: 'Synchronizing Cursor Vectors' }, { id: 'mi-aud-4-2', title: 'The Delta Buffer Format' }] },
      { id: 'mi-aud-ch5', title: 'Sector 05: Efficiency Benchmarking', subTopics: [{ id: 'mi-aud-5-1', title: 'Wattage Delta vs Physical Execution' }, { id: 'mi-aud-5-2', title: 'Zero-Provisioning Latency' }] },
      { id: 'mi-aud-ch6', title: 'Sector 06: Scribe Architecture', subTopics: [{ id: 'mi-aud-6-1', title: 'Offscreen Canvas Compositing' }, { id: 'mi-aud-6-2', title: 'VP9 Bitrate Governor Profiles' }] },
      { id: 'mi-aud-ch7', title: 'Sector 07: Drift Mathematics', subTopics: [{ id: 'mi-aud-7-1', title: 'Semantic vs. Syntactic Divergence' }, { id: 'mi-aud-7-2', title: 'Vectorizing Cognitive Gaps' }] },
      { id: 'mi-aud-ch8', title: 'Sector 08: Persistent Ledger', subTopics: [{ id: 'mi-aud-8-1', title: 'Binary Sharding Overhead' }, { id: 'mi-aud-8-2', title: 'Atomic Restoration Limits' }] },
      { id: 'mi-aud-ch9', title: 'Sector 09: Social Engineering', subTopics: [{ id: 'mi-aud-9-1', title: 'Stochastic Stakeholder Personas' }, { id: 'mi-aud-9-2', title: 'Pressure-Response Metrics' }] },
      { id: 'mi-aud-ch10', title: 'Sector 10: Recursive Curriculum', subTopics: [{ id: 'mi-aud-10-1', title: 'The Gap-Closing Algorithm' }, { id: 'mi-aud-10-2', title: 'Refractive Study Pathing' }] }
    ],
    lectures: {
      "Pedagogical Friction Design": {
        topic: "Pedagogical Friction Design",
        professorName: "Socratic Lead",
        studentName: "Staff Candidate",
        sections: [
          { speaker: "Teacher", text: "Welcome to the technical audit for MockInterview Studio v7.0.0-ULTRA. We have discarded the 'Assistant' model of interaction. Most AI tools optimize for user satisfaction; we optimize for 'Pedagogical Friction.' This means our prompt engineering specifically instructs Gemini to look for high-entropy moments—points where the candidate's logic is fragile or unproven. Learning and evaluation occur exclusively in this zone." },
          { speaker: "Student", text: "How do you distinguish between constructive technical friction and simple user frustration? A model that just says 'No' isn't helpful for learning." },
          { speaker: "Teacher", text: "We utilize the 'Probe-Wait Cycle.' When a candidate submits a plan, the AI dispatches a 'Probe'—a clarifying question about a specific edge case, such as a network partition or a race condition in a thread pool. The system then enters a 'Wait' state, measuring the 'Time to Signal'—how long it takes the candidate to translate their mental model into spoken reasoning or Monaco code. This is the 'Mastery Threshold.' If the candidate provides a shallow answer, the friction increases. If they provide a deep, Staff-level defense, the AI 'refracts' into a supportive peer role. We are testing for Technical Authority, which can only be measured under load." }
        ]
      },
      "Phase-Alignment of Audio Streams": {
        topic: "Phase-Alignment of Audio Streams",
        professorName: "Audio Systems Lead",
        studentName: "Candidate",
        sections: [
          { speaker: "Teacher", text: "Sector 02: Real-time Interrogation. Latency is the primary killer of natural technical dialogue. Powered by Gemini 2.5 Native Audio, we bypass the browser's standard MediaRecorder API. Instead, we stream raw Float32 PCM data directly through a high-priority WebSocket link." },
          { speaker: "Student", text: "Does this affect how the AI hears my tone? I know standard compressed audio loses a lot of the high-frequency data used for emotional cues." },
          { speaker: "Teacher", text: "Precisely. By streaming at 16kHz raw, the AI detects 'Nuance Jitter'—the micro-pauses and pitch shifts that indicate cognitive doubt. When you are explaining a complex recursive function, the AI isn't just parsing words; it is analyzing the 'Fluency Vector.' If it detects a mismatch between your confident tone and a logically incorrect code delta, it triggers a 'Deep-Dive Interrogation.' This is multimodal alignment at the edge. We ensure that the 'Phase' of the audio is aligned with the 'Turn' of the reasoning, achieving sub-200ms round-trip times." }
        ]
      },
      "Memory Address Space Emulation": {
        topic: "Memory Address Space Emulation",
        professorName: "Systems Architect",
        studentName: "Kernel Candidate",
        sections: [
          { speaker: "Teacher", text: "Sector 03: Heuristic Execution. The 'Run' button in the Studio performs a 'Latent Execution.' We use Gemini 3 Flash to simulate the physical state of a POSIX-compliant machine. But we go deeper than simple text output; we instruct the model to maintain a 'Virtual Address Space' in its context window." },
          { speaker: "Student", text: "So it actually tracks pointer addresses like 0x7ffd in its imagination?" },
          { speaker: "Teacher", text: "Yes. For a C++ audit, the AI traces the stack and heap pointers. If you return a reference to a local variable, the simulation doesn't just crash; it identifies the 'Dangling Pointer' refraction. It knows the stack frame has been popped and the memory is now invalid. We have moved from 'Syntax Checking' to 'Heuristic State Tracing.' This allows us to evaluate a candidate's understanding of systems-level memory safety without needing a physical debugger. We trade 100% precision for 1000% speed and Socratic depth." }
        ]
      },
      "Synchronizing Cursor Vectors": {
        topic: "Synchronizing Cursor Vectors",
        professorName: "Visual Architect",
        studentName: "Developer",
        sections: [
          { speaker: "Teacher", text: "Sector 04: Interleaving. To provide Staff-level feedback, the AI must 'see' your hands as well as 'hear' your voice. We implement the 'Interleaved Delta Protocol.' Every 200ms, we serialize the cursor position (Line:Column) and the sparse text delta into a unified Neural Snapshot." },
          { speaker: "Student", text: "Why include the cursor? Isn't the code content enough for the AI to understand my progress?" },
          { speaker: "Teacher", text: "The cursor is the 'Intent Vector.' If you are explaining a load balancer verbally but your cursor is lingering on a specific line of database logic, the AI detects the 'Context Mismatch.' It knows you are distracted or that your mental model is diverging from your implementation. This synchronization allows the AI to say, 'I see you are hovering over the connection pool on line 24, but you just mentioned the caching layer.' This creates the 'Refractive Presence' that makes the Studio feel like a real human peer review. We are pumping context at 60Hz to ensure the 'Handshake' never drops." }
        ]
      },
      "Wattage Delta vs Physical Execution": {
        topic: "Wattage Delta vs Physical Execution",
        professorName: "Sustainability Lead",
        studentName: "Auditor",
        sections: [
          { speaker: "Teacher", text: "Sector 05: Thermodynamics. The 10x Efficiency Proof is our most quantifiable breakthrough. Traditional technical evaluation platforms boot a new Docker container for every 'Run' command. This is a massive waste of global compute energy." },
          { speaker: "Student", text: "Is the energy saving really that significant compared to the cost of an LLM inference pass?" },
          { speaker: "Teacher", text: "In a physical build, the infrastructure lifecycle—provisioning, dependency linking, and teardown—accounts for 90% of the energy cost. The actual logic execution is less than 10%. By using Gemini 3 Flash to 'imagine' the output, we eliminate the entire infrastructure overhead. We trade kilowatts of container orchestration for millijoules of neural refraction. For the purpose of evaluation, where the code only runs for a few milliseconds, our 'Heuristic Simulation' is 10 times more energy-efficient. We are replacing hardware cycles with prediction cycles." }
        ]
      },
      "Offscreen Canvas Compositing": {
        topic: "Offscreen Canvas Compositing",
        professorName: "Visual Systems Lead",
        studentName: "Auditor",
        sections: [
          { speaker: "Teacher", text: "Sector 06: Capture. Standard browser recording is brittle. If a candidate minimizes the window or switches tabs to check a reference, the recording often drops frames. In v7.0.0-ULTRA, we record a hidden 1920x1080 'Compositor Canvas' at a strict 30FPS." },
          { speaker: "Student", text: "How do you maintain that framerate if the browser tab is throttled by the OS?" },
          { speaker: "Teacher", text: "We use the 'Frame-Flow Handshake.' We bypass `requestAnimationFrame` and utilize high-stability Web Worker intervals. Our compositor stitches three layers: the primary hero workspace, a high-fidelity camera portal, and a Gaussian-blurred backdrop for aesthetic continuity. We output an 8Mbps VP9 stream directly to a local Blob buffer. This ensures that the 'Staff-Level Performance Record' is permanent and frame-perfect, regardless of the browser's background state. The result is a professional-grade technical artifact archived to the user's sovereign vault." }
        ]
      },
      "Semantic vs. Syntactic Divergence": {
        topic: "Semantic vs. Syntactic Divergence",
        professorName: "Staff Evaluator",
        studentName: "Candidate",
        sections: [
          { speaker: "Teacher", text: "Sector 07: Drift. The most sophisticated metric in the Studio is 'Architectural Drift.' We measure the delta between your verbal 'Semantic Intent' and your physical 'Syntactic Implementation.' We vectorize both streams using Gemini 3 Pro." },
          { speaker: "Student", text: "Give me a specific example of a 'High-Risk Drift' that the AI would flag." },
          { speaker: "Teacher", text: "Imagine you describe a 'Lock-Free Queue' verbally, citing the performance benefits of atomic operations. But in the Monaco Editor, you implement a standard Mutex-based solution. The AI detects this divergence instantly. It doesn't just mark the code as 'working'; it flags a cognitive gap. You understand the theory, but cannot yet refract it into implementation. This is the 'Deep Signal' that allows us to build the 10-Week Refraction Plan. We identify the specific 'Logical Pole' where your technical authority fails and provide targeted drills to close that gap." }
        ]
      },
      "Binary Sharding Overhead": {
        topic: "Binary Sharding Overhead",
        professorName: "Data Architect",
        studentName: "Auditor",
        sections: [
          { speaker: "Teacher", text: "Sector 08: Ledger Integrity. Building a production-grade hub requires solving the 'Mass Problem.' Firestore enforces a strict 1MB limit. A 45-minute session with high-fidelity audio easily exceeds this. We use the 'Binary Chunking Protocol' (BCP)." },
          { speaker: "Student", text: "How much latency does sharding add to the session startup when reconstructing the audio buffer?" },
          { speaker: "Teacher", text: "By using 'Parallel Fetching,' we keep hydration under 150ms. We shard data into exactly 750,000-byte segments. A parent 'Manifest Node' tracks the sequence and SHA-256 hashes. Upon startup, our edge engine dispatches simultaneous requests for all shards and stitches them in-memory. We have turned a standard NoSQL ledger into a high-performance block store, ensuring that the depth of the AI's reasoning is never constrained by cloud database physics. Your technical history is a persistent, sharded artifact." }
        ]
      },
      "Stochastic Stakeholder Personas": {
        topic: "Stochastic Stakeholder Personas",
        professorName: "Behavioral Coach",
        studentName: "Candidate",
        sections: [
          { speaker: "Teacher", text: "Sector 09: Social Engineering. Staff engineering is 50% technical and 50% navigation of friction. We simulate this via 'Stochastic Stakeholder Refraction.' The AI can switch personas mid-interview—from the 'Junior Dev' who needs an explanation to the 'Grumpy CTO' who demands a budget justification." },
          { speaker: "Student", text: "Does the AI change its 'Logic Gate' based on the persona being simulated?" },
          { speaker: "Teacher", text: "Yes. The 'Grumpy CTO' persona triggers a focus on 'Maintenance Thermodynamics' and 'Cost-of-Equity' in your tech choices. The 'Junior Dev' persona evaluates your ability to mentor and simplify complexity. We measure your 'Refractive Speed'—how fast you can translate the same technical logic into different business contexts. If you can't defend your architecture under social pressure, you aren't ready for a lead role. We are building 'Anti-Fragile' professionals." }
        ]
      },
      "The Gap-Closing Algorithm": {
        topic: "The Gap-Closing Algorithm",
        professorName: "Chief Architect",
        studentName: "Engineer",
        sections: [
          { speaker: "Teacher", text: "Sector 10: Completion. The session ends with the '10-Week Refraction Plan.' This isn't a generic study guide. It is synthesized by Gemini 3 Pro after analyzing your 45-minute performance record. It uses a 'Gap-Closing Algorithm' to identify the shortest path from your current signal to a Staff-level manifest." },
          { speaker: "Student", text: "How does the plan adapt if I improve faster than the algorithm originally predicted?" },
          { speaker: "Teacher", text: "The plan is 'Recursive.' As you complete drills in the Studio, the AI monitors your 'Drift' metrics. If a concept like 'Distributed Consensus' is mastered in Week 3, the algorithm skips the redundant Week 4 content and refracts the curriculum toward higher-level abstractions like 'Byzantine Fault Tolerance.' We are automating the evolution of technical talent. By the end of Week 10, your 'Neural Signal' matches the requirements of elite engineering firms. This is the final refraction of the Prism: professional reshaping complete. Refraction complete. End of manifest. v7.0.0-ULTRA." }
        ]
      }
    }
  }
};
