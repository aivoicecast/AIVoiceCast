
import { Chapter, GeneratedLecture } from '../types';

export const OFFLINE_CHANNEL_ID = 'aivoicecast-platform-official-v2';

export const OFFLINE_CURRICULUM: Chapter[] = [
  {
    id: 'ch-1',
    title: 'Evolution of the Platform',
    subTopics: [
      { id: 'ch-1-sub-1', title: 'From Player to Operating System' },
      { id: 'ch-1-sub-2', title: 'The Unified App Suite Pattern' },
      { id: 'ch-1-sub-3', title: 'Context-Aware Layouts' }
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
    title: 'The Card Workshop',
    subTopics: [
      { id: 'ch-3-sub-1', title: 'HTML Canvas to PDF' },
      { id: 'ch-3-sub-2', title: 'Generative Art with Gemini' },
      { id: 'ch-3-sub-3', title: 'Packaging Assets with JSZip' }
    ]
  },
  {
    id: 'ch-4',
    title: 'Generative Publishing',
    subTopics: [
      { id: 'ch-4-sub-1', title: 'Instant Book Synthesis' },
      { id: 'ch-4-sub-2', title: 'Automated Table of Contents' },
      { id: 'ch-4-sub-3', title: 'From Audio to Print' }
    ]
  },
  {
    id: 'ch-5',
    title: 'Social & Career Graph',
    subTopics: [
      { id: 'ch-5-sub-1', title: 'RBAC with Firestore Rules' },
      { id: 'ch-5-sub-2', title: 'The Invite System Logic' },
      { id: 'ch-5-sub-3', title: 'Job Board Data Model' }
    ]
  },
  {
    id: 'ch-6',
    title: 'AI Integration Strategy',
    subTopics: [
      { id: 'ch-6-sub-1', title: 'Prompt Engineering for Personas' },
      { id: 'ch-6-sub-2', title: 'Function Calling in Live Mode' },
      { id: 'ch-6-sub-3', title: 'Multimodal Input (Screen/Cam)' }
    ]
  }
];

// Map of "Topic Title" -> GeneratedLecture
export const OFFLINE_LECTURES: Record<string, GeneratedLecture> = {
  "From Player to Operating System": {
    topic: "From Player to Operating System",
    professorName: "Lead Architect",
    studentName: "Developer",
    sections: [
      {
        speaker: "Teacher",
        text: "In v1, AIVoiceCast was just a list of audio tracks. In v3.85, it is an Operating System for knowledge work. We introduced the concept of 'App Suites'."
      },
      {
        speaker: "Student",
        text: "What does that mean technically? Is it still a React app?"
      },
      {
        speaker: "Teacher",
        text: "Yes, but we shifted from a simple Router to a `ViewState` manager. The App component now acts as a window manager. It switches context between the Podcast Player, Code Studio, and Card Workshop without reloading the page."
      }
    ]
  },
  "Instant Book Synthesis": {
    topic: "Instant Book Synthesis",
    professorName: "Product Lead",
    studentName: "Content Creator",
    sections: [
      {
        speaker: "Teacher",
        text: "Members can now generate a full-length book from any curriculum. By iterating through the 'Chapters' and 'Sub-topics', our engine uses Gemini to draft complete lecture scripts and then assembles them into a high-resolution PDF."
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
  }
};
