
import { Chapter, GeneratedLecture } from '../types';

export const OFFLINE_CHANNEL_ID = 'neural-prism-platform-official';

export const OFFLINE_CURRICULUM: Chapter[] = [
  {
    id: 'ch-1',
    title: 'Evolution of the Prism',
    subTopics: [
      { id: 'ch-1-sub-1', title: 'From Player to Intelligence Hub' },
      { id: 'ch-1-sub-2', title: 'The Rainbow Tool Pattern' },
      { id: 'ch-1-sub-3', title: 'Triple-Layer Data Sovereignty' }
    ]
  },
  {
    id: 'ch-2',
    title: 'Code Studio Architecture',
    subTopics: [
      { id: 'ch-2-sub-1', title: 'Virtual File Systems (VFS)' },
      { id: 'ch-2-sub-2', title: 'Lazy Loading GitHub Trees' },
      { id: 'ch-2-sub-3', title: 'Monaco Editor Integration' }
    ]
  },
  {
    id: 'ch-3',
    title: 'Visual Labs',
    subTopics: [
      { id: 'ch-3-sub-1', title: 'HTML Canvas to PDF' },
      { id: 'ch-3-sub-2', title: 'Generative Art Refraction' },
      { id: 'ch-3-sub-3', title: 'Packaging Assets with JSZip' }
    ]
  },
  {
    id: 'ch-4',
    title: 'Generative Knowledge',
    subTopics: [
      { id: 'ch-4-sub-1', title: 'Instant Book Synthesis' },
      { id: 'ch-4-sub-2', title: 'Automated Table of Contents' },
      { id: 'ch-4-sub-3', title: 'Digital Cash & Sovereign Tokens' }
    ]
  },
  {
    id: 'ch-5',
    title: 'Identity & Authority v7.0.0-ULTRA',
    subTopics: [
      { id: 'ch-5-sub-1', title: 'The Sovereign Bake Protocol' },
      { id: 'ch-5-sub-2', title: 'Offline Trust Root Architecture' },
      { id: 'ch-5-sub-3', title: 'Badge Studio & Biometric Attestation' }
    ]
  }
];

// Map of "Topic Title" -> GeneratedLecture
export const OFFLINE_LECTURES: Record<string, GeneratedLecture> = {
  "From Player to Intelligence Hub": {
    topic: "From Player to Intelligence Hub",
    professorName: "Lead Architect",
    studentName: "Developer",
    sections: [
      {
        speaker: "Teacher",
        text: "In v1, we were just a player. In v7.0.0-ULTRA, Neural Prism is an Intelligence Hub for human activities. We introduced the concept of 'Rainbow Tools'."
      },
      {
        speaker: "Student",
        text: "What does that mean technically? Is it still a React app?"
      },
      {
        speaker: "Teacher",
        text: "Yes, but we shifted from a simple list to a 'Refractive Interface'. The platform switches context between the Activity Hub, Builder Studio, and Finance Lab without friction, focusing on human context first."
      }
    ]
  },
  "Triple-Layer Data Sovereignty": {
      topic: "Triple-Layer Data Sovereignty",
      professorName: "Security Lead",
      studentName: "Auditor",
      sections: [
          { speaker: "Teacher", text: "We manage data across three distinct tiers. Level 1 is the Firestore Control Plane for metadata. Level 2 is the Knowledge Vault in Firebase Storage for the raw JSON corpus." },
          { speaker: "Student", text: "And Level 3?" },
          { speaker: "Teacher", text: "Level 3 is the Local Data Plane in IndexedDB. We use this to cache neural audio fragments. This ensures that even if you're in a tunnel, your interactive sessions stay high-fidelity and zero-latency." }
      ]
  },
  "Instant Book Synthesis": {
    topic: "Instant Book Synthesis",
    professorName: "Product Lead",
    studentName: "Content Creator",
    sections: [
      {
        speaker: "Teacher",
        text: "Members can now generate a full-length book from any curriculum. Our engine uses Gemini to draft complete lecture scripts and then assembles them into a high-resolution PDF."
      },
      {
        speaker: "Student",
        text: "How do you handle the formatting for something so large?"
      },
      {
        speaker: "Teacher",
        text: "We use an off-screen rasterization process. Each lesson is rendered as a standalone page using html2canvas, then bundled by jsPDF. This ensures consistent font rendering and layout, mirroring the web view perfectly in the final print."
      }
    ]
  },
  "Digital Cash & Sovereign Tokens": {
    topic: "Digital Cash & Sovereign Tokens",
    professorName: "Finance Architect",
    studentName: "Merchant",
    sections: [
      {
        speaker: "Teacher",
        text: "The Token tab introduces 'Digital Cash' to the Prism. It allows you to create a Sovereign Token—a cryptographically signed promise of value that works like a digital check."
      },
      {
        speaker: "Student",
        text: "Why do we need tokens if we have standard transfers?"
      },
      {
        speaker: "Teacher",
        text: "Trustless Sovereignty. In a standard transfer, the server moves the coins. With a Sovereign Token, your device uses its local ECDSA P-256 Private Key to sign the value. The server cannot move these coins without your physical hardware's approval. It also allows for 'Asynchronous Gifting'—you can send a redemption link via any chat app, even if the recipient is offline."
      },
      {
        speaker: "Student",
        text: "Is it secure against forgery?"
      },
      {
        speaker: "Teacher",
        text: "Absolutely. If someone tries to change the amount in the link from 10 to 100, the cryptographic signature will mismatch, and the Neural Handshake will be refused. It is a bridge between the physical certainty of cash and the digital speed of the ledger."
      }
    ]
  },
  "Virtual File Systems (VFS)": {
    topic: "Virtual File Systems (VFS)",
    professorName: "Systems Engineer",
    studentName: "Junior Dev",
    sections: [
      {
        speaker: "Teacher",
        text: "The Code Studio handles files from GitHub, Google Drive, and Private Cloud using an abstract VFS layer."
      },
      {
        speaker: "Student",
        text: "So the editor doesn't know where the file comes from?"
      },
      {
        speaker: "Teacher",
        text: "Exactly. We normalize everything into a `CodeFile` interface. When you click 'Save', the VFS checks the active tab and dispatches the write operation to the correct API service."
      }
    ]
  },
  "The Sovereign Bake Protocol": {
    topic: "The Sovereign Bake Protocol",
    professorName: "Security Architect",
    studentName: "Digital Notary",
    sections: [
      {
        speaker: "Teacher",
        text: "Welcome to the Sovereign Signer deep dive. In v7.0.0-ULTRA, we solve the 'Multi-Page Hash Divergence' problem using the Sovereign Bake protocol."
      },
      {
        speaker: "Student",
        text: "Why do hashes change when we add a signature to a PDF?"
      },
      {
        speaker: "Teacher",
        text: "Standard PDF libraries often re-serialize only the pages you touch. This creates non-deterministic byte-streams for the rest of the document. We 'Bake' the document by applying zero-opacity anchor nodes to every single page before hashing. This forces a full, consistent re-serialization."
      }
    ]
  },
  "Offline Trust Root Architecture": {
    topic: "Offline Trust Root Architecture",
    professorName: "Identity Lead",
    studentName: "Resident",
    sections: [
      {
        speaker: "Teacher",
        text: "Trust shouldn't require an internet connection. The Neural Prism uses an 'Offline Trust Root'."
      },
      {
        speaker: "Student",
        text: "How can my phone verify someone without checking a database?"
      },
      {
        speaker: "Teacher",
        text: "Every instance of our app contains the Platform Root Public Key. When you scan a peer's QR code, your device uses this built-in key to verify the cryptographic signature on their 'Identity Shard'. It's zero-knowledge, zero-latency, and 100% sovereign."
      }
    ]
  },
  "Badge Studio & Biometric Attestation": {
    topic: "Badge Studio & Biometric Attestation",
    professorName: "Verification Expert",
    studentName: "Member",
    sections: [
      {
        speaker: "Teacher",
        text: "Badge Studio transforms your digital identity into a high-fidelity artifact. We use Biometric Attestation to verify 'Secure' status."
      },
      {
        speaker: "Student",
        text: "What makes a badge 'Secure' vs 'Standard'?"
      },
      {
        speaker: "Teacher",
        text: "A 'Secure' badge requires a live camera capture. This proves physical presence and prevents the injection of synthetic AI images. Each secure badge is registered with a unique UUID on our global registry for remote third-party validation."
      }
    ]
  }
};
