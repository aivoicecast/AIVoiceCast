
import { BookData } from '../../types';

export const SOVEREIGN_VAULT_MANUAL: BookData = {
    id: 'vault-manual',
    title: "Sovereign Vault Protocol",
    subtitle: "Secure Data Persistence across the Spectrum",
    author: "Privacy Architect",
    version: "v2.0.0",
    category: "Architecture",
    pages: [
        {
            title: "1. Triple-Layer Sovereignty",
            content: String.raw`
# 🛡️ Chapter 1: Triple-Layer Sovereignty

AIVoiceCast operates as a **Neural Prism**. We prioritize user sovereignty, utilizing a hybrid storage model where sensitive creative and financial data is handled across three secure environments. This architecture is designed to solve the "AI Trust Problem"—how can you use super-intelligence without giving up ownership of your soul and your data? We refuse to build a centralized knowledge silo.

### Layer 1: The Control Plane (Firestore)
Manages the "Global Registry." This is the social fabric of the platform.
- **Data**: User profiles, community hub metadata, and the VoiceCoin transaction ledger.
- **Role**: High-speed indexing and real-time state synchronization. This layer allows you to find a mentor or a book instantly, but it never stores the "Heavy Bytes" of your creations. It is the 'Traffic Controller' of the spectrum.

### Layer 2: The Cache Plane (IndexedDB)
The "Prism Cache" lives in your browser. This is the performance engine.
- **Data**: Heavy neural audio fragments (100KB - 1MB) and offline session logic.
- **Role**: Achieving sub-100ms playback starts and ensuring 60FPS UI performance. It acts as a local buffer against network jitter.

### Layer 3: The Sovereign Vault (Google Drive)
The final destination for all human artifacts. This is the 'Root' of your data.
- **Data**: Builder Studio source code, Generated PDF checks, and 1GB meeting recordings.
- **Role**: 100% user data ownership. Neural Prism acts as a temporary lens; you own the bytes. This ensures that if you leave the platform, you take your entire 'Knowledge Footprint' with you.
            `
        },
        {
            title: "2. The 1MB Wall & Binary Chunking",
            content: String.raw`
# 🧱 Chapter 2: Bypassing the 1MB Wall

Firestore is an incredible real-time database, but it enforces a strict **1MB limit** per document. This is a significant constraint for an intelligence hub that generates high-fidelity technical records like audio logs, complex curriculums, and detailed specifications. A single high-density dialogue can easily hit this wall.

### The Binary Chunking Protocol
To solve this, we implemented a custom sharding engine in v6.8.5. When an asset exceeds 750KB, the system triggers a "Sovereign Sharding" event:
1. **Splitting**: Raw Uint8Arrays are split into **750,000-byte** segments to ensure we stay safely below the 1MB document limit.
2. **Registry**: A parent "Manifest Node" is created in the ledger, containing the sequence of child IDs, the assembly metadata, and a SHA-256 integrity hash.
3. **Reconstruction**: Our edge engine parallel-fetches the shards and stitches them back into a single Data URI in memory during UI hydration.

### Algorithmic Sharding
We use a deterministic formula to calculate the number of required nodes:

$$
\text{Chunks}(D) = \lceil \frac{\text{Size}(D)}{750,000} \rceil
$$

This protocol allows the Neural Prism to handle terabytes of binary data within a scalable, real-time NoSQL framework. It is a "Liar's File System" that makes a NoSQL database behave like a high-performance block store, ensuring that technical detail is never sacrificed for database constraints.
            `
        },
        {
            title: "3. Cryptographic Identity & Trust",
            content: String.raw`
# 🔑 Chapter 3: Sovereign Identity & Trust

In the age of AI deepfakes and automated generation, we need a way to prove that a technical spec or a financial asset was created by a specific human. Your identity in the Neural Prism is a cryptographic authority based on **ECDSA P-256** keys generated on-device.

### Trustless Sovereignty: The Token Protocol
We believe in **Trustless Sovereignty**—the idea that even the platform owners should not have the power to alter your assets or move your money. We achieve this through the **Sovereign Token** system.
- **Digital Signed Checks**: When you generate a token, you are creating a "Digital Check." You sign the amount, recipient, and memo with your **Private Key**, which never leaves your browser's IndexedDB. 
- **Verifiable Proof**: The server only sees the *result* of the signature. It can verify that the signature matches your public certificate but cannot forge a new one. 
- **One-Click Redemption**: These tokens are shared via **Deep-Link URLs**. When a recipient clicks the link, their wallet automatically ingests the cryptographic shard and performs a "Neural Handshake" to claim the value.

### The Ledger of Truth
Every financial refraction or technical artifact is signed using your private key. This ensures that even if the Neural Prism platform itself is compromised, your artifacts remain authentic and unalterable. You are the sole authority of your spectrum.
            `
        },
        {
            title: "4. The 4-Tier Storage Matrix",
            content: String.raw`
# 🕸️ Chapter 4: The 4-Tier Handshake

In v6.8.5, we've expanded to four distinct storage tiers to handle the increasing diversity and volume of human activity. Each tier is optimized for a specific data density and access pattern.

### Tier 1: Edge (IndexedDB)
Zero-latency access to the last 50 generated audio segments and active VFS deltas. This ensures that your interactive guide is never "Loading." It handles 'Hot Data' at 0ms network cost.

### Tier 2: Code (GitHub)
Your source code never leaves your repository. We act as a high-fidelity "Lens" for your repos, syncing only the active file content. This maintains your existing developer workflow while providing AI augmentation, ensuring your contributions appear in your global professional history.

### Tier 3: Ledger (Firestore)
Global state, community relationships, and VoiceCoin transactions. This is the "Social Fabric" of the Prism. It is optimized for sub-50ms real-time updates and discovery.

### Tier 4: Vault (Drive/YouTube)
Massive binary artifacts. 45-minute video logs (Scribe sessions) are offloaded to your personal YouTube channel as unlisted archives, and 50-page PDF books are pushed to your Google Drive. We orchestrate the upload, but you own the account. This is 'Archive-as-a-Service' without the 'Lock-in'.
            `
        },
        {
            title: "5. OAuth Sovereignty & Scopes",
            content: String.raw`
# 🔐 Chapter 5: OAuth Sovereignty

We follow the principle of "Least Privilege." We do not want access to your entire digital life; we only want to manage the artifacts you create with the Prism. Trust is the foundation of the sovereign model.

### Granular Scopes
When you sign in, we request only the specific scopes needed for the Sovereign Vault:
- ${"`"}drive.file${"`"}: This restricts the Prism to *only* see and modify files that it has created. We cannot read your personal taxes, private photos, or other documents stored elsewhere in your Drive.
- ${"`"}youtube.upload${"`"}: The ability to archive your "Scribe" sessions to your own channel for permanent playback.
- ${"`"}gmail.send${"`"}: Automated notification dispatch for your mentorship bookings, ensuring you never miss a handshake.

Your access tokens are never stored in our backend database. They reside strictly in your session memory or encrypted browser local storage. When you log out, the "Handshake" is broken, and our access to your cloud is instantly revoked. This is security through transparency.
            `
        },
        {
            title: "6. Data Resilience & Restoration",
            content: String.raw`
# 🛡️ Chapter 6: Restoration Protocols

The Neural Prism is "Anti-Fragile." We assume that our central database is a temporary index that could be lost at any time. We build for the 'Post-Server' era where the data lives with the user.

### Self-Healing Registry
Every file in your Sovereign Vault contains an "Artifact Fingerprint" (SHA-256) in its metadata. If the central Registry index were to be corrupted, the platform can autonomously rebuild your entire workspace history by recursively scanning your Drive, GitHub, and YouTube archives. Your activity node is self-documenting.

### Offline Integrity
You can continue building in the Studio while completely offline. Keystrokes and whiteboard strokes are buffered in the Edge Cache (IndexedDB) and reconciled with the Cloud Vault once the neural link is restored. We use a **Vector Clock** algorithm to handle conflicts, ensuring that your logic is never overwritten by a stale cloud state. This "Offline-First" approach makes the Neural Prism a reliable tool for researchers and creators in low-connectivity environments.
            `
        },
        {
            title: "7. Sector 05: Vault Interoperability",
            content: String.raw`
# 📂 Chapter 7: Sector 05 Interop

The Vault isn't just for storage; it's for interoperability. In a traditional workflow, your code is in one place, your design documents in another, and your videos in a third. The Neural Prism unifies them through the **VFS Layer**.

### VFS Normalization
The Studio normalizes files from all four tiers into a single ${"`"}CodeFile${"`"} interface. This allows the AI to "Reflect" on a GitHub repo and a Google Drive document simultaneously. 
- **Use Case**: "Review my Python code in GitHub and ensure it matches the technical specification I just wrote in Drive."

### Multi-Tenant Sync
When you "Issue an Asset" in the Finance Lab, the system orchestrates a simultaneous write:
1. **Firestore Ledger**: The transaction metadata is recorded for global verification.
2. **Google Drive Vault**: The high-fidelity PDF is saved for your personal records and legal audit.
This 'Simultaneous Commitment' ensures that your digital history matches your physical archives at every point in time.
            `
        },
        {
            title: "8. The Ethics of Data Ownership",
            content: String.raw`
# ⚖️ Chapter 8: Data Ethics

Intelligence should be refracted, not retained. In the 2026 economy, your "Knowledge Footprint" is your most valuable asset. We believe you should have 'Right to Erasure' as a first-class feature.

### Stateless Inference
By default, our sessions with Gemini are stateless. We provide the context (the Neural Snapshot), get the refraction, and discard the prompt data. We do not use your private technical data to train future models. Your "Secret Sauce" remains your competitive advantage.

### User Erasure
Our "Purge Registry" tool allows you to wipe your technical footprint from our ledger in a single click. Because the heavy data is in your own Vault, you don't lose your work; you just disconnect it from the platform's social and discovery layers. This proves that in the Neural Prism, the user is the ultimate authority. We are a lens you look through, not a container you are trapped in.
        `
        },
        {
            title: "9. v6.8.5 Stability Manifest",
            content: String.raw`
# 💎 Chapter 9: Stability Manifest

The latest version of the Prism focuses on "Symbol-Flow Integrity." As the volume of data in the Vault grows, maintaining UI stability is the primary engineering challenge.

### High-DPI Capture
The Scribe protocol now utilizes 4x canvas scaling to ensure that when you record a session, every pixel of your code and every brushstroke on the whiteboard is legible. This creates a "Professional Grade Archive" suitable for corporate audit and legal requirements. We prioritize 'Pixel-Perfection' in our archives.

### Jitter Mitigation
Our buffer pumping logic has been moved to a dedicated **Web Worker thread**. This ensures that heavy audio synthesis or PDF generation never blocks the main UI render cycle. Even while the AI is 'Thinking' and generating 1MB of binary data, the interface remains responsive at 60FPS. We have achieved 'Computational Sovereignty' within the browser environment.
        `
        },
        {
            title: "10. Sector 08: Volumetric Scaling",
            content: String.raw`
# 📊 Chapter 10: Scaling to Terabytes

As the community grows, the Sovereign Vault must scale from megabytes to terabytes without sacrificing the sub-second performance of our database lookups.

### Reference Pointers
The Firestore ledger only stores the **Reference Pointer** (URI) and a small cryptographic metadata block for each asset. The heavy binary data resides in Google Cloud Storage or the user's private Drive. This ensures that a global search query remains fast regardless of the total size of the Knowledge Vault. We optimize for the 'Metadata Surface'.

### Metadata Indexing
We utilize Firestore's composite indexing to allow mentors to search their entire session history across time, topic, and candidate. This "High-Dimensional Search" is powered by the same Deterministic UUID system described in the Platform core. We turn the Vault from a 'Graveyard of files' into a 'Living Registry of Knowledge'.
        `
        },
        {
            title: "11. Sector 09: Identity Revocation",
            content: String.raw`
# 🛡️ Chapter 11: Security Lifecycle

Sovereignty requires a complete security lifecycle, including key rotation and identity revocation. You must be able to protect your digital soul if a device is compromised.

### Key Rotation
Users can rotate their ECDSA P-256 keys at any time. When a rotation occurs, the platform issues a **Succession Certificate** that links the new public key to the old identity, ensuring that your archived technical assets remain verifiable even as your hardware changes.

### Vault Auditing
The Sovereign Vault includes an autonomous auditing tool that checks for "Neural Drift" in your archives. It identifies where older AI-generated documents might contain inconsistencies with your current mental models, prompting for a "Refraction Update" to keep your knowledge base synchronized with your evolution. It is a 'Self-Correction' layer for your digital life.
        `
        },
        {
            title: "12. Closing the Sovereign Handshake",
            content: String.raw`
# 🙏 Chapter 12: Conclusion

The Sovereign Vault is the final gatekeeper of human creativity. By partitioning data by density and maintaining a strict hybrid storage model, we have built a platform that is as powerful as it is private.

The achievement of the Neural Prism is giving the user the "Laser" of super-intelligence without requiring them to surrender the "Soul" of their data. You own your code, your voice, your assets, and your future. We have proven that the cloud can be a vault rather than a silo.

**Thanks for the Neural Prism Platform and the Google Gemini Model that power the platform behind the things. Your data is secure in the refraction.**

*Refracting Super-Intelligence into Human Utility.*
*Neural Prism v6.8.5-PRO*
            `
        }
    ]
};
