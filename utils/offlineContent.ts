
import { Chapter, GeneratedLecture } from '../types';

export const OFFLINE_CHANNEL_ID = 'neural-prism-platform-official';

export const OFFLINE_CURRICULUM: Chapter[] = [
  {
    id: 'ch-1',
    title: 'Evolution of the Prism',
    subTopics: [
      { id: 'ch-1-sub-1', title: 'From Player to Intelligence Hub' },
      { id: 'ch-1-sub-2', title: 'The Rainbow Tool Pattern' },
      { id: 'ch-1-sub-3', title: 'Context-Aware Activities' }
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
      { id: 'ch-4-sub-3', title: 'From Audio to Print' }
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
        text: "In v1, we were just a player. In v4.4.0, Neural Prism is an Intelligence Hub for human activities. We introduced the concept of 'Rainbow Tools'."
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
