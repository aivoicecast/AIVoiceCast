
import { BookData } from '../bookContent';

export const MOCK_INTERVIEW_BOOK: BookData = {
  id: 'mock-interview-core',
  title: "The Socratic Interrogator",
  subtitle: "Multi-Modal Technical Evaluation via Neural Simulation",
  author: "Neural Evaluation Team",
  version: "v6.8.5-SPEC",
  category: "Evaluation",
  pages: [
    {
      title: "1. The Socratic Paradigm",
      content: String.raw`
# 🎓 Chapter 1: The Socratic Paradigm

Technical interviewing is not just a test of knowledge; it is an interrogation of mental models. Most current AI tools suffer from the "Agreeable Assistant" bias—they are designed for user comfort. They give you the answer, pat you on the back, and tell you that your code looks "great." This creates a false sense of security that is destroyed during a real Staff-level interview.

### The Refractive Shift
The **Socratic Interrogator** is the "Hero Refraction" of the Neural Prism. In this paradigm, the AI is not your friend. It is your **Peer Evaluator.** It prioritizes logical purity over user comfort. If you suggest a sub-optimal O(N^2) solution, the AI does not offer polite encouragement. It identifies the quadratic bottleneck on line 42 and demands a defense of that choice in the context of a high-scale production system.

### The Zone of Friction
Learning and evaluation occur in the **Zone of Friction.** If there is no friction, there is no growth. The Socratic method—asking "Why" and "How" instead of providing answers—forces you into a "Reasoning Out Loud" state. This allows the auditor to see the 'Logic Gaps' in your thinking. By forcing you to defend your architectural choices in real-time, we trigger a deeper cognitive 'Refraction' that leads to permanent skill acquisition.

$$
\text{Competence}(K) = \frac{\text{Correctness}(C) \times \text{Reasoning}(R)}{\text{Time}(T)}
$$

We are measuring the density of your logic, not the speed of your typing.
      `
    },
    {
      title: "2. The Emotive Link",
      content: String.raw`
# 🎙️ Chapter 2: Emotive Link Mechanics

We use the **Gemini 2.5 Flash Native Audio** model to achieve sub-200ms verbal response times. This is our "Emotive Link." Standard Text-to-Speech (TTS) systems introduce a "Latency Wall" that destroys the natural flow of a technical debate. If the AI takes 3 seconds to respond, it is an assistant. If it responds in 150ms, it is a partner.

### Natural Interruption
In a real Staff-level interview, the interviewer interrupts you the moment they see you going down a flawed path. Our Emotive Link allows the AI to perform "Natural Interruption." 
- **Candidate**: "So I'll just use a global variable to store the state—"
- **AI**: "Wait, stop there. Why a global variable? Think about the concurrency implications for a multi-threaded environment."

This immediate feedback loop prevents the candidate from wasting time on a flawed approach and evaluates their ability to pivot their mental model under pressure. It is the difference between a static exam and a living conversation.

### Auditory Audit
The AI listens for nuances in your "Inner Monologue." We analyze the pauses, the pace, and the pitch to identify "Hesitation Nodes"—moments where your voice indicates uncertainty even if your words are technically correct. This provides a multi-modal assessment of confidence and seniority that text-only models cannot replicate. We are evaluating the person, not just the code.
      `
    },
    {
      title: "3. Logic Tracing & Digital Twins",
      content: String.raw`
# 🏗️ Chapter 3: Digital Twin Simulation

We bypass compilers entirely for the purpose of evaluation. We use **Gemini 3 Flash** to act as a "Digital Twin" of a POSIX terminal. It imagines the execution of your code with >98% parity for algorithmic tasks. This is not 'mocking'; it is 'prediction-based execution'.

### Why Simulation?
1. **Safety**: You can write infinite loops, buffer overflows, or memory leaks, and the AI will simply simulate the system hang or the crash without affecting our underlying infrastructure.
2. **Speed**: There is zero wait time for a virtual machine to boot or a compiler to run. The "Run" button is strictly inference latency. This maintains the 'Refractive Flow'.
3. **Socratic Debugging**: If your code has a bug, the AI doesn't give you a cryptic stack trace. It opens a "Logic Tunnel"—a series of questions that lead you to discover the off-by-one error or the race condition on your own.

This creates a safe, high-speed developer environment for extreme exploration. You are not writing code for a machine; you are describing logic to a super-intelligent observer who understands the laws of computation.
      `
    },
    {
      title: "4. The Scribe Protocol",
      content: String.raw`
# 📹 Chapter 4: The Scribe Protocol

To capture a "Staff-Level Performance Record," we record a hidden 1920x1080 canvas. Standard browser recording tools lose the camera overlay when you switch tabs, which is a common occurrence during a complex interview as you reference documentation or architecture specs.

### Canvas Compositor
Our compositor stitches three layers into a single **8Mbps VP9 stream**:
1. **Backdrop**: A Gaussian-blurred reflection of your workspace for a premium, unified aesthetic.
2. **Hero**: The active Monaco Editor or Visual Canvas.
3. **Portal**: A circular PIP (Picture-in-Picture) camera portal with high-fidelity borders.

### Frame-Flow Handshake
To prevent frozen videos caused by browser background throttling, we implemented a "Frame-Flow Handshake." We utilize high-stability intervals to ensure that even if the browser throttles the tab, the recording continues at a steady 30FPS. This ensures zero dropped frames, creating a verifiable record of your performance that persists to your Sovereign Vault. This artifact is yours to keep, review, and share with mentors. It is a cinematic history of your technical growth.
      `
    },
    {
      title: "5. Shorten the Gap",
      content: String.raw`
# 📊 Chapter 5: Evaluation Synthesis

Once a session ends, **Gemini 3 Pro** audits the "Neural Snapshot"—the 45-minute archive of your multi-modal performance. This is the heart of the "Shorten the Gap" engine. We don't just give you a grade; we give you a path.

### Identifying Unknowns
The AI finds exactly where your mental model fails. It doesn't just look for syntax bugs; it looks for "Architectural Drift." Did you choose a B-Tree when an LSM tree was more appropriate for the write-heavy requirement? Did you fail to handle a network partition in your distributed systems design? These are 'Identified Unknowns'.

### The 10-Week Refraction Plan
The AI synthesizes a personalized curriculum based on these unknowns. 
- **Week 1**: Deep dive into Distributed Consensus (Raft vs Paxos).
- **Week 2**: Mastering Memory Safety and Smart Pointers in C++.
Each week triggers specialized Socratic lectures in the **Podcast Lab** and algorithmic drills in the **Builder Studio**. By the end of the 10 weeks, the candidate can return for a "Re-Interrogation" to verify their growth. This is career development as a service.
      `
    },
    {
      title: "6. The 4-Tier Storage Matrix",
      content: String.raw`
# 🛡️ Chapter 6: Sovereign Data Integrity

Your performance data is managed across four backends based on density and sensitivity. We believe that career data should be as sovereign as financial data. You should never be locked out of your own growth record.

1. **Tier 1: Edge Cache (IndexedDB)**: UI state and neural audio fragments. This ensures that when you start an interrogation, the professor starts speaking instantly without a "loading" spinner.
2. **Tier 2: Registry (Firestore)**: Real-time state and global ledger metadata. This tracks your progress and community rankings.
3. **Tier 3: Source (GitHub)**: Your source code remains in your own repository. We act only as a lens for your repo, ensuring your work contributes to your public portfolio.
4. **Tier 4: Vault (Drive/YouTube)**: 1GB video logs are archived to your personal cloud.

This ensures you maintain **100% ownership** of your technical artifacts. We provide the refractive lens; you own the captured light. This is the cornerstone of our Trust Model.
      `
    },
    {
      title: "7. Socratic Feedback Loops",
      content: String.raw`
# 🔄 Chapter 7: Feedback Loops

The Interrogator provides feedback *during* the session, not just at the end. This mirrors the best real-world interviewers who want to see how you learn and adapt.

### Real-time Refraction
If you get stuck, the AI doesn't give the answer. It provides a "High-Level Refraction"—a new way to look at the problem. 
- **AI**: "Think about this array as a state machine instead of a list. How does that change your transition logic?"

This evaluates how quickly you can pivot your mental model based on a technical hint. A candidate who can pivot based on a subtle architectural observation is often more valuable than one who has simply memorized the answer. We track this "Delta of Competence" across the 45-minute window to see how you respond to corrective signals. It is a test of 'Trainability' as much as 'Knowledge'.
      `
    },
    {
      title: "8. The Ethics of AI Evaluation",
      content: String.raw`
# ⚖️ Chapter 8: Evaluation without Ego

Human interviewers often suffer from "Selection Bias" and "Ego-Collision." They want you to solve the problem *their* way. Our AI is designed for **Evaluation without Ego.** It doesn't care about your style; it cares about your logic.

### Transparency
Candidates have full visibility into the AI's "Diagnostic Console." You can see the raw tokens and the "Heuristic Logs" that led to a specific critique. This removes the "Black Box" anxiety from technical preparation and replaces it with objective data.

### Objective Auditing
The Socratic Interrogator treats all candidates equally, focusing strictly on the logic of the code and the clarity of the reasoning. This provides an objective baseline for professional growth. By removing the social anxiety of the interview, we allow the candidate's true technical depth to shine through the refractive prism.
      `
    },
    {
      title: "9. The Humanoid Shift",
      content: String.raw`
# 🤖 Chapter 9: Physical Socraticism

By running our simulation logic on on-device models, the mock interview transforms into a face-to-face interaction with a **Humanoid Mentor**. We are preparing for a world beyond the screen.

### Beyond the Screen
We believe the 2026 vision is a world where everyone has a "Staff Engineer" in their living room. A humanoid robot can point to a physical whiteboard, explain memory buffers using physical tokens, and provide real-time facial feedback based on your confidence.

### Multi-Sensory Learning
Physical Socraticism turns the "Mock Interview" into a "Technical Workshop." It creates a multi-sensory learning environment that leads to permanent skill acquisition. This is the ultimate goal of the Neural Prism: democratizing elite career coaching for every family on earth. We are using the most advanced silicon to empower the most ancient human way of learning: face-to-face dialogue.
      `
    },
    {
      title: "10. Sector 07: Behavioral Refraction",
      content: String.raw`
# 👔 Chapter 10: The Behavioral Interrogation

Staff-level engineers are judged more by their leadership and communication than their syntax. Sector 07 focuses on "System Failure Post-Mortems" and "Conflict Resolution."

### Simulating Stakeholders
The Interrogator simulates various personas during the behavioral phase to test your 'Soft Refraction':
- **The Grumpy PM**: "Why is this taking two weeks? Can't we just use a simple SQL trigger?"
- **The Junior Dev**: "I think we should use this new experimental library I found on Reddit."

The candidate is evaluated on their ability to defend architectural integrity while acknowledging business constraints and mentoring their simulated teammates. We measure empathy, technical authority, and the ability to explain complex trade-offs to non-technical stakeholders. It is an end-to-end evaluation of the 'Modern Lead'.
      `
    },
    {
      title: "11. Identifying Conceptual Drift",
      content: String.raw`
# 🧬 Chapter 11: The Drift Matrix

Conceptual Drift is the delta between a candidate's verbal explanation and their physical implementation. This is often where Senior engineers are separated from Staff engineers.

### The Linguistic-Code Gap
If a candidate explains a thread-safe Singleton verbally but writes code with a double-checked locking bug, the AI flags a "High-Risk Drift." This indicates that the candidate is relying on "Memorized Patterns" rather than "First-Principles Reasoning."

We utilize Gemini 3 Pro to perform this cross-modal verification. It is the most powerful way to uncover "Identified Unknowns" that are hidden by conversational fluency. We force you to bridge the gap between what you say and what you build, ensuring your technical foundation is solid from the ground up.
      `
    },
    {
      title: "12. Closing the Manifest",
      content: String.raw`
# 🙏 Chapter 12: Conclusion

The Socratic Interrogator turns the anxiety of the interview into the beauty of a technical debate. We have proven that by maintaining technical friction and prioritizing logical purity, we can use super-intelligence to uncover and refine human potential.

The 2026 vision is a world where everyone has a "Staff Engineer" in their pocket (or their living room), helping them shorten the gap between their current state and their highest potential. We are building the final bridge between superhuman capacity and daily human utility.

**Thanks for the Neural Prism Platform and the Google Gemini Model that power the platform behind the things. We are ready to refract your career.**

*Refracting Super-Intelligence into Human Utility.*
*Neural Prism v6.8.5-PRO*
      `
    }
  ]
};
