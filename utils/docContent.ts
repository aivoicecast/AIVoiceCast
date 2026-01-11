
import { CommunityDiscussion } from '../types';

export const APP_COMPARISON_DOC: CommunityDiscussion = {
  id: 'system-doc-001',
  lectureId: 'system-architecture',
  channelId: 'system',
  userId: 'system',
  userName: 'System Architect',
  transcript: [],
  createdAt: 1766016000000, 
  isManual: true,
  title: "AIVoiceCast: The Knowledge OS Specification",
  designDoc: `
# AIVoiceCast: System Architecture & Neural OS Specification

**Revision:** 4.3.0 | **Author:** Lead Architect | **Date:** Dec 20, 2025

## 1. Philosophical Transition
AIVoiceCast has evolved from a "Podcast Player" into a **Knowledge Operating System**. The core design philosophy shifts from *passive consumption* to *active creation and transaction*. 

## 2. The Application Suite Architecture
The platform now manages a modular suite of apps within a single \`ViewState\` lifecycle.

| Domain | Application | Backend Storage | Engine |
| :--- | :--- | :--- | :--- |
| **Code** | Code Studio | Drive / GitHub / Cloud | Neural Simulation (Flash) |
| **Design** | Whiteboard / Icon Lab | Firestore / Storage | Flash Image |
| **Finance** | Coin Wallet / Check Lab | Web Crypto / Ledger | ECDSA P-256 |
| **Utility** | Shipping Lab | Local / Google Drive | Flash Pro |
| **Research** | Neural Lab | Firestore / IDB | Flash (API) |

## 3. Neural Execution Engine (Simulation Logic)
Unlike professional editors (OnlineGDB, Coderbyte) that utilize Docker containers for real execution, AIVoiceCast implements **Heuristic Logic Tracing**.

### Comparison Table: Execution Paradigms

| Feature | Docker (OnlineGDB) | Wasm (StackBlitz) | Neural Sim (AIVoiceCast) |
| :--- | :--- | :--- | :--- |
| **Backend** | Remote Linux Server | Browser Runtime | AI Model (Gemini Flash) |
| **Integrity** | 100% Machine Precise | 100% Machine Precise | 98% Heuristic Precision |
| **Flexibility** | Needs specific install | Needs Wasm Port | Language Agnostic (Any) |
| **Security** | Sandbox required | Client-side safe | Total Isolation (Predicted) |

## 4. VoiceCoin Financial Protocol (VCFP)
v4.2.0 introduced the **VoiceCoin Protocol**, a decentralized-style ledger built atop Google Cloud.

## 5. Multi-Backend Persistence
To ensure maximum user control, AIVoiceCast implements a tiered persistence model:
- **Hot Data (IndexedDB):** Audio cache and ephemeral session states.
- **Trusted Data (Firestore):** Identity certificates, ledger history.
- **User Sovereign Data (Google Drive):** Source code, published PDFs.

## 6. Neural Link Resilience (v4.3.0 Updates)
To handle long-running sessions (30m+), the Neural OS implements three critical stability layers:

### A. Preemptive Neural Rotation
WebSockets are prone to infrastructure-level timeouts (approx. 5 mins). The OS automatically recycles the link every **300 seconds** (±10s jitter).
- **Graceful Handover:** The rotation only triggers during AI silence.
- **Context Stitching:** The last 25 turns of the transcript are injected into the new session's \`systemInstruction\` to preserve continuity.

### B. Neural Cooling & Rate Management
The system detects **HTTP 429 (Resource Exhausted)** errors and enters a "Neural Cooling" state. This prevents aggressive retry-looping and protects the user's API quota.

### C. Heartbeat Keep-Alive
A persistent null-text heartbeat is transmitted every **15 seconds** during silence to prevent idle-timeout disconnections from the Gemini Gateway.

## 7. Conclusion
The v4.3.0 architecture establishes AIVoiceCast as a "Resilient Dream Machine"—a system capable of maintaining long-term neural connections for complex meetings and deep learning sessions.
`
};
