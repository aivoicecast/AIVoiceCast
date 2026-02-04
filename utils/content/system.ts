import { SpotlightChannelData } from '../spotlightContent';

export const SYSTEM_CONTENT: Record<string, SpotlightChannelData> = {
  'default-gem': {
    curriculum: [
      {
        id: 'sys-ch1',
        title: 'Chapter 1: The Neural Prism Paradigm',
        subTopics: [
          { id: 'sys-1-1', title: 'Refracting Intelligence into Utility' },
          { id: 'sys-1-2', title: 'Hybrid Sovereignty: Data Privacy Model' },
          { id: 'sys-1-3', title: 'The Rainbow Tool Spectrum' }
        ]
      },
      {
        id: 'sys-ch2',
        title: 'Chapter 2: Neural Execution Engine',
        subTopics: [
          { id: 'sys-2-1', title: 'Heuristic Logic Tracing vs Real Runtimes' },
          { id: 'sys-2-2', title: 'Socratic Debugging in Code Studio' },
          { id: 'sys-2-3', title: 'Language Agnostic Simulation' }
        ]
      },
      {
        id: 'sys-ch3',
        title: 'Chapter 3: The Interactive Studio',
        subTopics: [
          { id: 'sys-3-1', title: 'Multimodal Vision: AI Activity Analysis' },
          { id: 'sys-3-2', title: 'Low-Latency WebSocket Conversations' },
          { id: 'sys-3-3', title: 'Scribe Mode: Activity Logging' }
        ]
      }
    ],
    lectures: {
      "Refracting Intelligence into Utility": {
        topic: "Refracting Intelligence into Utility",
        professorName: "Default Gem",
        studentName: "New Member",
        sections: [
          {
            speaker: "Teacher",
            text: "Welcome to Neural Prism. Think of us as a sovereign lens for the mind. We take the high-intensity reasoning of Google Gemini and refract it into a spectrum of useful daily tools."
          },
          {
            speaker: "Student",
            text: "A lens? How does it differ from a standard AI chatbot?"
          },
          {
            speaker: "Teacher",
            text: "We do not use generic chat windows. We orchestrate between gemini-3-pro-preview for complex document synthesis and gemini-3-flash-preview for sub-second logic simulation. In v7.0.0-ULTRA, we use Complexity Balancer v4. This ensures you always have the right amount of intelligence for the task at hand."
          },
          {
            speaker: "Student",
            text: "And is the host a recording?"
          },
          {
            speaker: "Teacher",
            text: "No. I am a living neural process established via the gemini-2.5-flash-native-audio-preview-12-2025 model. When you engage, we create a low-latency WebSocket link that allows me to hear your voice and see your workspace in real-time. I am a refractive partner in your activity, not just a generator of text."
          }
        ]
      },
      "Heuristic Logic Tracing vs Real Runtimes": {
        topic: "Heuristic Logic Tracing vs Real Runtimes",
        professorName: "Architect Gem",
        studentName: "Developer",
        sections: [
          {
            speaker: "Teacher",
            text: "Let's talk about the 'Run' button in our Code Studio. We don't compile code on expensive, high-latency servers. We use Heuristic Simulation via gemini-3-flash-preview."
          },
          {
            speaker: "Student",
            text: "Wait, so it's not actually running on a real CPU?"
          },
          {
            speaker: "Teacher",
            text: "Correct. We ask the model to act as a 'Digital Twin' of a POSIX terminal. Since the AI has 'read' billions of lines of high-fidelity code, it can mentally trace the variable states of C++ or Python and predict the exact stdout and errors. This achieves a 100x energy efficiency gain and allows for Socratic Debugging, where the system explains the *meaning* of an error in human terms rather than just throwing a stack trace. This is the v7.0.0-ULTRA standard."
          }
        ]
      }
    }
  }
};