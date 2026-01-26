
import { CommunityDiscussion } from '../types';

export const APP_COMPARISON_DOC: CommunityDiscussion = {
  id: 'system-doc-001',
  lectureId: 'system-architecture',
  channelId: 'system',
  userId: 'system',
  userName: 'System Architect',
  transcript: [],
  createdAt: 1769308800000, 
  isManual: true,
  title: "Neural Prism: The Human-AI Interface Spec",
  designDoc: `
# Neural Prism: Architecture of Accessibility

**Revision:** 5.0.0 | **Author:** Lead Architect | **Date:** Jan 25, 2026

## 1. Philosophical Refraction
The Neural Prism Platform moves beyond the "Knowledge OS" model. Our core architecture acts as a **refractive lens** for AI Super-Intelligence. 

### The Input-Output Model:
- **Input:** High-dimensional, complex AI reasoning (Gemini 3 Pro).
- **Refraction:** Contextual adaptation and daily-activity mapping.
- **Output:** The "Rainbow Spectrum"—a user-friendly suite of 20+ specialized tools.

## 2. Spectrum Components
The platform manages a modular suite of tools designed for daily human life.

| Activity Category | Tools | Technology |
| :--- | :--- | :--- |
| **Daily Living** | Shipping Lab / Check Lab / Gift Workshop | Flash Image / PDF-Gen |
| **Professional** | Interview Prep / Talent Hub / Careers | Live Audio / Vision |
| **Logic & Dev** | Builder Studio / Research Lab / Visualizer | Neural Simulation |
| **Community** | Team Space / Communities / Mentorship | Real-time Ledger |

## 3. Human-Centric Logic (Simulation)
We prioritize **Heuristic Tracing** over traditional execution. This ensures that users can interact with logic in a "safe, conversational sandbox."

### Why Human-Centric Beats Real Runtimes:
1. **Explainability:** The system can explain *why* something happens in human terms.
2. **Speed:** Instant results without the "boot time" of real servers.
3. **Safety:** High-risk code is simulated, never truly executed on hardware.

## 4. Federated Contribution
Every member of the Neural Prism community is a "Prism Contributor." The platform supports an exponential growth model where members can:
- Define new activity types.
- Curate custom knowledge paths.
- Sign and verify transactions via the VoiceCoin Ledger.

## 5. Privacy & Sovereignty
Intelligence is Refracted, not Retained. 
- **Ephemeral Sessions:** Logic processing is stateless by default.
- **Personal Storage:** All created assets (PDFs, Code, Records) are funneled directly into the user's private Google Drive.

## 6. Stability Protocols
v5.0.0 maintains the "Resilient Dream Machine" standard:
- **Preemptive Rotation:** Continuous AI availability for long-running human activities.
- **Neural Snapshot Sync:** Mandatory code-in-prompt bundling for zero-latency visibility.
- **Multi-modal Grounding:** The AI sees the user's physical or digital context in real-time.

## 7. Vision Statement
The Neural Prism is the final bridge between superhuman AI capacity and daily human utility. We make complexity invisible and intelligence colorful.
`
};

export const STACK_STORY_DOC: CommunityDiscussion = {
  id: 'system-doc-stack-story',
  lectureId: 'stack-story',
  channelId: 'system',
  userId: 'system',
  userName: 'Lead Architect',
  transcript: [],
  createdAt: 1769308800000,
  isManual: true,
  title: "The Stack Story: Building the Prism",
  designDoc: `
# 🌈 The Stack Story: Building Neural Prism

## The Technical "Prism"
Building a platform that handles real-time voice, code simulation, and secure financial asset generation required a unique "Refractive" stack.

### Core Stack Components:
- **Frontend**: React 19 + Tailwind CSS for a high-performance, responsive refractive UI.
- **AI Brain**: Google Gemini 3.0 (Pro & Flash). We utilize Flash for low-latency simulation and Pro for complex reasoning.
- **Real-time Link**: WebSockets via the Gemini Live API for "Always-on" multimodal collaboration.
- **The Ledger**: Firebase Firestore managing a decentralized identity model (ECDSA P-256) and the VoiceCoin economy.
- **The Vault**: Google Drive API for user-sovereign data persistence.

## Engineering Challenges
1. **Ghosting in the VFS**: Solving the synchronization loop between AI code edits and Google Drive auto-saves.
2. **Deterministic Simulation**: Tuning Gemini 3 Flash to act as a reliable digital twin for C++ and Python runtimes.
3. **Audio Latency**: Implementing a local IndexedDB cache for neural audio fragments to achieve sub-100ms playback starts.

## The Goal
To prove that AI is best used not as a search engine, but as a **context-aware activity partner**.
`
};

export const BUILT_WITH_DOC: CommunityDiscussion = {
  id: 'system-doc-built-with',
  lectureId: 'built-with',
  channelId: 'system',
  userId: 'system',
  userName: 'System Architect',
  transcript: [],
  createdAt: 1769308800000,
  isManual: true,
  title: "Technical Manifest: Built With",
  designDoc: `
# 🛠️ Technical Manifest: The Neural Prism Stack

## 1. Frameworks & Languages
- **React 19**: Modern UI component architecture.
- **TypeScript**: Robust application logic.
- **Tailwind CSS**: Refractive, utility-first design.

## 2. Artificial Intelligence (Gemini 3.0)
- **Pro Model**: Complex reasoning and document synthesis.
- **Flash Model**: Heuristic logic simulation and rapid response.
- **Live API**: Multimodal WebSockets for real-time collaboration.
- **Image & TTS**: Generative art and emotive speech.

## 3. Infrastructure & Platforms
- **Firebase**: Secure authentication and community data plane.
- **Google Cloud Platform**: Drive, YouTube, and Gmail integration.
- **GitHub API**: Developer workflow synchronization.

## 4. Edge Computing
- **IndexedDB**: High-speed asset caching.
- **Web Crypto API**: ECDSA P-256 decentralized identity.
- **WebGL**: Hardware-accelerated math visualization (Plotly).

## 5. Specialized Libraries
- **Monaco Editor**: Professional IDE capabilities.
- **html2canvas / jsPDF**: High-fidelity document rendering.
- **JSZip**: Neural asset packaging.
- **KaTeX**: Mathematical typesetting.
`
};
