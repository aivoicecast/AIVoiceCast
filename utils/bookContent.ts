
export interface BookPage {
  title: string;
  content: string;
}

export interface BookData {
  title: string;
  subtitle: string;
  author: string;
  version: string;
  pages: BookPage[];
}

export const NEURAL_PRISM_BOOK: BookData = {
  title: "The Neural Prism Platform",
  subtitle: "Refracting Super-Intelligence into Human Utility",
  author: "Prism Architect Team",
  version: "v6.1.1",
  pages: [
    {
      title: "I. The Refractive Philosophy",
      content: `
# 🌈 Introduction: The Prism Metaphor

Neural Prism is not just another AI application. It is a fundamental shift in how humans interact with super-intelligent models. While traditional interfaces force users to learn complex prompting, the Neural Prism Platform acts as a refractive lens—taking raw, blindingly powerful intelligence and splitting it into a beautiful, useful spectrum of domain-specific tools.

### Why "Refraction"?
Traditional AI interaction is like staring at the sun; the output is too broad and the input is too complex. We "refract" this light. 
**Example:** Instead of asking a chatbot to "write a check," you enter a dedicated Finance Lab where the UI handles the metadata, and the AI performs specific, high-precision tasks like linguistic word synthesis and visual DNA generation.

**Gemini API Used:** We utilize the **Gemini 3 Pro** model's massive 2-million-token context window to hold entire project histories (code, docs, recordings) as the "source light" before refracting it into individual tool outputs.
      `
    },
    {
      title: "II. Core Architecture: The Triple-Layer Engine",
      content: `
# 🏗️ Architecture: Hybrid Resilience

The reliability and privacy of the Neural Prism are powered by our **Triple-Layer Engine**, utilizing a hybrid approach to caching and persistence.

### Layer 1: The Control Plane (Cloud Registry)
**Powered by:** Google Firebase Firestore & Storage.
**Role:** This is the "Global Intelligence Ledger." Every refraction (lecture, code audit, or art prompt) is uniquely identified via a **Deterministic UUID**. 
**Sharing Mechanism:** If any user in the community generates a high-intensity refraction, the result is cached globally in the Cloud Vault. Subsequent users requesting the same node receive the asset instantly, ensuring **100% Energy Efficiency** by never computing the same complex logic twice.

### Layer 2: The Neural Cache (User's Edge)
**Powered by:** Browser IndexedDB.
**Role:** This is the "Local Performance Tier." We store raw PCM audio fragments and ephemeral session states directly in the user's browser.
**Why?** To achieve sub-100ms response times. By moving the "Edge" to the user's machine, the UI remains fluid even during high-bandwidth multimodal sessions. This layer acts as a sovereign buffer, allowing for offline study and preventing redundant network handshakes.

### Layer 3: The Sovereign Vault (Personal Storage)
**Powered by:** Google Drive API.
**Role:** Absolute Privacy. We are a lens, not a silo. Your intellectual property (Code, PDFs, Recordings) never lives on our servers. Final artifacts are funneled directly to your private cloud via OAuth 2.0.
      `
    },
    {
      title: "III. Neural Simulation",
      content: `
# 🧠 Innovation: Heuristic Logic Tracing

Our most disruptive feature is the **Builder Studio Neural IDE**. It replaces heavy server-side compilers with AI-driven simulation.

### How does it work?
When you click "Run," we don't boot a Linux VM. Instead, we use **Gemini 3 Flash** with a **Thinking Budget of 0**. We provide the model with a "Digital Twin" system prompt, instructing it to mentally execute the logic and predict the STDOUT.

### Why is this better?
1. **Infrastructure-less:** Run C++, Rust, or Python on a static web app.
2. **Zero-Trust Security:** Malicious code (e.g., a script trying to 'rm -rf /') is simply simulated. The AI returns "Permission Denied," and no real hardware is ever at risk.
3. **Socratic Debugging:** Instead of a raw SEGFAULT, the AI explains: *"I noticed your pointer was uninitialized on line 42; here is why that would crash a real kernel."*

**Example:** A developer can prototype a complex multi-threaded database logic and see the "imagined" race conditions before ever writing a single real Makefile.
      `
    },
    {
      title: "IV. Multimodal Interaction",
      content: `
# 🎙️ The Interactive Studio: Real-Time Handshakes

Neural Prism moves beyond text. We utilize the **Gemini 2.5 Flash Native Audio** model to create "Always-On" collaboration.

### How?
The studio establishes a persistent WebSocket link. We stream raw 16kHz mono PCM audio from the microphone directly to the model. Simultaneously, we "inject" the current workspace context (the code you're writing or the doc you're editing) into every turn of the conversation.

### Why?
Traditional voice bots use "Transcribe -> Text API -> TTS," which takes 3-5 seconds. Our **Native Audio** implementation responds in <500ms. 
**Result:** You can interrupt the AI, show it your screen via the camera, and it will say: *"I see you've added the header on line 5, let's talk about the implementation now."*

**Gemini API Used:** \`gemini-2.5-flash-native-audio-preview-12-2025\` with real-time function calling for in-place workspace updates.
      `
    },
    {
      title: "V. The Finance Lab",
      content: `
# 💳 Refracting Trust: The Neural Check Protocol

How do we turn AI into a verifiable financial tool? The Finance Lab demonstrates high-fidelity asset generation.

### The Refraction Pipeline:
1. **Linguistic Synthesis:** Gemini 3 Flash takes "$1,250.00" and synthesizes the precise legal words: *"ONE THOUSAND TWO HUNDRED FIFTY AND 00/100."*
2. **Visual DNA:** A unique security watermark is generated for every check. The AI analyzes the transaction metadata to create a fractal pattern that is mathematically linked to that specific payment.
3. **Identity Handshake:** Physical signatures are captured via a 2D canvas and linked to an on-device **ECDSA P-256** private key.

**Why?** To eliminate "Check Washing" and manual errors. Every check is a cryptographically verifiable artifact stored in the user's Google Drive and indexed on the global ledger.
      `
    },
    {
      title: "VI. Impact & Future",
      content: `
# 🌈 Conclusion: The Future of Human Logic

Neural Prism is the final bridge between superhuman AI capacity and daily human utility.

### How does this scale?
The platform is designed for **Federated Refraction**. In the future, any member can publish a "Prism Component"—a custom UI and prompt set for a new activity (e.g., a "Legal Contract Refractor" or a "Medical Lab Interpreter").

### Why does this matter for the judge?
This project demonstrates that the future of AI isn't more chatbots; it's **Context-Aware Tooling**. We have traded generic "chatting" for a high-fidelity, multimodal, and user-sovereign ecosystem that respects privacy and maximizes the unique strengths of the Gemini 3 series.
      `
    },
    {
      title: "VII. Global Observability",
      content: `
# 🐞 The Pulse: Neural Diagnostic Console

The most critical component for platform stability is the **Neural Diagnostic Console** (toggled via the red Bug icon). It serves as the "Nervous System" of the Prism.

### How it works:
We implemented a global **Neural Event Bus**. Every time a component performs an AI operation—whether it is a cache hit in the Scripture Sanctuary or a tool-call in the Code Studio—it dispatches a \`neural-log\` custom event.

### Key Features:
1. **Neural Fingerprint**: Real-time verification of user identity, clearance level (Free vs. Pro), and model availability.
2. **Feature Integrity Manifest**: A self-checking list that verifies all 20+ specialized modules are registered and responsive.
3. **The Throttled Buffer**: To prevent UI lag during high-frequency AI activities (like Live Audio streaming), the console uses a **Batch-Update Engine** that decouples log ingestion from the render cycle.
4. **Judge Diagnostics**: This console allows technical auditors to see the "Raw Trace" of every Gemini handshake, providing 100% transparency into the platform's decision-making logic.

**Visual Design:** Styled as a "Black Box" flight recorder with a high-contrast red-on-black aesthetic, ensuring technical logs are clearly separated from the user-friendly activity UI.
      `
    },
    {
      title: "VIII. The Self-Enhancement Loop",
      content: `
# 🔄 Self-Correction: Feedback Refraction

The final pillar of the Neural Prism architecture is the **Sovereign Feedback Protocol**, accessible directly within the Neural Diagnostic Console.

### Human-in-the-Loop Refraction:
We have bridged the gap between user observation and model evolution. When a member encounters a bug or identifies a potential feature refraction, they can submit a **Neural Feedback Report**.

### Technical Trace Bundling:
Every feedback submission is not just text. The system automatically bundles the **last 20 technical log traces**—including model handshake metadata, error states, and terminal logs—into the payload.

### The AI Studio Handshake:
1. **Packaging**: Human input is contextually linked to the technical trace in Firestore.
2. **Auto-Feedback**: This comprehensive data packet is formatted for ingestion by **Google AI Studio**.
3. **Self-Enhancement**: The AI analyzes the failure points in the "Raw Trace" against the user's intent to self-correct logic, refine system instructions, or initiate the design of a new Neural Lab.

**Why it matters:** This creates a recursive loop where the platform learns from its own refractions, ensuring that the "Prism" becomes sharper and more accurate with every human interaction.
      `
    },
    {
      title: "IX. High-Fidelity Refraction",
      content: `
# 💎 High-Fidelity Synthesis: High-DPI & Symbol Integrity

The v6.0 update addresses the critical challenge of **Symbol Persistence** in generated documentation.

### The Problem:
Standard rasterization often fails when processing complex Unicode symbols, emojis, or specialized mathematical glyphs. This leads to "broken box" artifacts in final PDFs.

### The v6.0 Fix (Symbol Flow):
We re-engineered the **Author Studio** to utilize a **Multi-Stage Synthesis Pipeline**:
1. **Layer Synchronization**: Every page is rendered on an off-screen high-DPI container.
2. **High-DPI Rasterization**: We utilize a 3x scaling factor during the \`html2canvas\` handshake, ensuring every pixel of a symbol is captured at sub-millimeter precision.
3. **Lossless Binding**: The resulting high-resolution buffers are bound into the final PDF using a lossless JPEG compression tier (0.95), preserving the visual fidelity of the "Neural Guide" across all devices.
      `
    },
    {
      title: "X. Sovereign Audio Protocols",
      content: `
# 🎙️ MacBook Troubleshooting: Silent Recordings Fix

A common issue on macOS is the "Silent Recording" bug, where the screen is captured but audio from other windows or the system is missing.

### Why does this happen?
Due to macOS security sandbox policies, browsers (Chrome/Safari) cannot automatically capture audio from "other windows" unless the user performs a specific **permission handshake**.

### The Solution for MacBook Users:
1. **System Audio Include**: When you click "Begin Neural Scribe", our system requests the \`systemAudio: "include"\` constraint.
2. **The "Share Audio" Checkbox**: When the browser's screen-picker dialog appears, you **MUST** look for a small checkbox in the bottom-left corner labeled **"Share system audio"**. 
3. **CRITICAL**: If this box is unchecked, the recording will be silent even if you hear the audio through your speakers.

### Tab vs. Screen Strategy:
- **Best Quality**: Select a **"Chrome Tab"** in the share dialog. This provides the most reliable audio link for web-based media (YouTube, Spotify Web, etc).
- **Desktop Apps**: To capture audio from apps like VS Code or Slack, you must share your **"Entire Screen"** and ensure the "Share Audio" toggle is active.

### Verification:
Check the **Neural Diagnostic Console** (Bug icon). If you see \`[System audio track verified]\`, the link is healthy. If you see \`[No system audio track detected]\`, you must restart the scribe and check the box in the browser dialog.

*Neural Prism v6.1.1: High-Fidelity Audio. Resilient. Sovereign.*
`
    }
  ]
};
