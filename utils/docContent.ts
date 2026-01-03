
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

**Revision:** 4.2.0 | **Author:** Lead Architect | **Date:** Dec 20, 2025

## 1. Philosophical Transition
AIVoiceCast has evolved from a "Podcast Player" into a **Knowledge Operating System**. The core design philosophy shifts from *passive consumption* to *active creation and transaction*. 

## 2. The Application Suite Architecture
The platform now manages a modular suite of apps within a single \`ViewState\` lifecycle. Each module acts as a specialized terminal for neural synthesis.

| Domain | Application | Backend Storage | Engine |
| :--- | :--- | :--- | :--- |
| **Code** | Code Studio | Drive / GitHub / Cloud | Gemini 3 Pro |
| **Design** | Whiteboard / Icon Lab | Firestore / Storage | Flash Image |
| **Finance** | Coin Wallet / Check Lab | Web Crypto / Ledger | ECDSA P-256 |
| **Utility** | Shipping Lab | Local / Google Drive | Flash Pro |
| **Research** | Neural Lab | Firestore / IDB | Flash (API) |

## 3. VoiceCoin Financial Protocol (VCFP)
v4.2.0 introduces the **VoiceCoin Protocol**, a decentralized-style ledger built atop Google Cloud.

### A. Identity Management
- **Local Keypair:** Every member generates a NIST P-256 keypair.
- **Trust Authority:** The platform signs member public keys to generate a **Neural Passport**.
- **Offline Signing:** Users can authorize payments offline using signed bearer tokens (Base64).

### B. Transaction Lifecycle
1. **Request:** Recipient generates a URI encoding their UID and amount range.
2. **Authorize:** Sender scans URI, signs the amount with their private key.
3. **Verification:** Recipient verifies the signature against the Sender's public certificate.
4. **Sync:** Upon next internet heartbeat, the token is cleared to the global ledger.

## 4. Multi-Backend Persistence
To ensure maximum user control, AIVoiceCast implements a tiered persistence model:
- **Hot Data (IndexedDB):** Audio cache and ephemeral session states.
- **Trusted Data (Firestore):** Identity certificates, ledger history, and community transcripts.
- **User Sovereign Data (Google Drive):** Source code, published PDFs, and meeting recordings.

## 5. Neural Synthesis Pipeline
The OS utilizes **Multimodal Context Mapping**. In the Code Studio or Whiteboard, the AI is not just a text assistant; it is a vision-capable peer. By analyzing screen frames alongside transcript context, the AI performs high-fidelity logic tasks like refactoring or architectural analysis in real-time.

## 6. Conclusion
The v4.2.0 architecture establishes AIVoiceCast as more than a community; it is a shared infrastructure for the next generation of knowledge work.
`
};
