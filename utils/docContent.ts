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

**Revision:** 4.5.6 | **Author:** Lead Architect | **Date:** Dec 26, 2025

## 1. Philosophical Transition
AIVoiceCast has evolved from a "Podcast Player" into a **Knowledge Operating System**. The core design philosophy shifts from *passive consumption* to *active creation and transaction*. 

## 2. The Application Suite Architecture
The platform now manages a modular suite of apps within a single \`ViewState\` lifecycle.

| Domain | Application | Backend Storage | Engine |
| :--- | :--- | :--- | :--- |
| **Code** | Code Studio | Drive / GitHub / Cloud | Heuristic Logic Simulation |
| **Design** | Whiteboard / Icon Lab | Firestore / Storage | Pro Image (4K Support) |
| **Finance** | Coin Wallet / Check Lab | Web Crypto / Ledger | ECDSA P-256 |
| **Utility** | Shipping Lab | Local / Google Drive | Flash Pro |
| **Research** | Neural Lab | Firestore / IDB | Persona Registry (Tuned) |

## 3. Neural Persona Registry (v4.5.6)
Unlike standard generic AI chats, AIVoiceCast utilizes a **Centralized Persona Registry**. This layer maps high-fidelity prebuilt voices to specific Tuned Model IDs:
- **Software Interviewer:** Optimized for algorithmic rigor (ID: 0648937375).
- **Kernel Maintainer:** Precision systems engineering (ID: 0375218270).

### Key Selection Workflow
To support high-fidelity and tuned models, the app implements a mandatory **API Key Selection** workflow. Users accessing these models are prompted to provide a billing-enabled key via the native AI Studio interface, ensuring platform scalability and addressing "Requested entity not found" edge cases.

## 4. Neural Execution Engine (Simulation Logic)
Unlike professional editors (OnlineGDB, Coderbyte) that utilize Docker containers for real execution, AIVoiceCast implements **Heuristic Logic Tracing**.

| Feature | Docker (OnlineGDB) | Wasm (StackBlitz) | Neural Sim (AIVoiceCast) |
| :--- | :--- | :--- | :--- |
| **Backend** | Remote Linux Server | Browser Runtime | AI Model (Gemini Flash) |
| **Integrity** | 100% Machine Precise | 100% Machine Precise | 98% Heuristic Precision |
| **Security** | Sandbox required | Client-side safe | Total Isolation (Predicted) |

## 5. Multi-Backend Persistence
To ensure maximum user control, AIVoiceCast implements a tiered persistence model:
- **Hot Data (IndexedDB):** Audio cache and ephemeral session states.
- **Trusted Data (Firestore):** Identity certificates, ledger history.
- **Sovereign Data (Google Drive):** Source code, published PDFs.

## 6. Conclusion
The v4.5.6 architecture establishes AIVoiceCast as a "Dream Machine"—a system capable of imagining and simulating any computing or specialized professional environment.
`
};