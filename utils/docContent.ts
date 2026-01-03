
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
  title: "AIVoiceCast: OS Design & Financial Protocol",
  designDoc: `
# AIVoiceCast: System Architecture & VoiceCoin Protocol

**Status:** Implementation Complete | **Author:** Lead Engineer | **Date:** Dec 19, 2025

## 1. Overview
AIVoiceCast has evolved into a full-featured "Knowledge OS." Beyond content consumption, it now implements a robust, decentralized-style financial layer called **VoiceCoin (VC)**, designed for peer-to-peer mentorship and contribution rewards.

## 2. VoiceCoin Financial Infrastructure

### A. Cryptographic Identity
Every member can generate a **unique digital identity**.
- **Engine:** Web Crypto API.
- **Algorithm:** ECDSA P-256 (NIST P-256).
- **Certificate:** Public keys are signed by the **AIVoiceCast Root Trust Key**, enabling offline verification between peers who have never met.

### B. The QR & URI Protocol
We use a standardized URI format for seamless transfers:
\`https://aivoicecast.com/?view=coin_wallet&pay={UID}&name={DISPLAY_NAME}\`
- **Receive Mode:** Generates a QR code encoding this URI. 
- **In-Store Logic:** A merchant/mentor displays their QR; the sender scans it, and the app auto-populates the recipient and triggers the transaction.

### C. Offline Resilience (The Ledger Sync)
One of our most advanced features is the **Pending Claims Queue**.
1. **Issuance:** A sender generates a cryptographically signed **Offline Payment Token** (Base64).
2. **Transfer:** This token is sent via any medium (QR, NFC, Chat).
3. **Queueing:** If the recipient is offline, the token is stored in **IndexedDB/LocalStorage** with a \`pending\` status.
4. **Auto-Sync:** A background service monitors \`navigator.onLine\`. Once connectivity is restored, the system automatically "clears" all pending tokens to the Firestore Global Ledger.

## 3. Application Pillars

| Feature | Document Studio | VoiceCoin Wallet |
| :--- | :--- | :--- |
| **Primary Intent** | Knowledge capture | Decentralized Economy |
| **Data Engine** | Markdown / PlantUML | ECDSA / Web Crypto |
| **Persistence** | Firestore / Google Drive | Global Ledger / IndexedDB |
| **AI Role** | Synthesizes transcripts | Validates signatures & amounts |

## 4. Technical Constraints & Security
- **Atomic Transactions:** All coin transfers use Firestore \`runTransaction\` to ensure balance integrity.
- **Non-Repudiation:** Offline tokens include a \`nonce\` and \`timestamp\` signed by the sender's private key, preventing replay attacks and double-claiming.
- **Trust Authority:** The platform acts as a lightweight Certificate Authority (CA) to sign member public keys.

## 5. Conclusion
AIVoiceCast v4.2.0 is now a self-sustaining ecosystem where high-quality learning is incentivized, and financial transactions are resilient to network outages.
`
};
