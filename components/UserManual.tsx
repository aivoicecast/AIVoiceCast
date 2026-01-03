import React from 'react';
import { ArrowLeft, Book } from 'lucide-react';
import { MarkdownView } from './MarkdownView';

interface UserManualProps {
  onBack: () => void;
}

const MANUAL_CONTENT = `
# 🎙️ AIVoiceCast User Guide

**The world's first decentralized, AI-native interactive knowledge community.**

AIVoiceCast is not just a podcast player. It is a **Generative Knowledge Engine**. Unlike Spotify or Apple Podcasts where you consume static audio, AIVoiceCast generates custom curriculums, synthesizes lectures on-demand, and allows you to **talk back** to the host in real-time.

---

### 🚀 The Neural Execution Engine (Exclusive)
One of the most powerful features in Code Studio is the "Run" button. But unlike other platforms, we don't use real servers to run your code. We use **Neural Simulation**.

*   **What is it?** We prompt **Gemini 3 Flash** to act as a Linux terminal. It "reads" your code and predicts the output.
*   **Why is it better for learning?** 
    *   **Speed:** No waiting for virtual machines to boot. 
    *   **Safety:** You can "run" dangerous code (like system deletions) to see the result without any risk to your hardware.
    *   **Socratic Debugging:** You can ask the AI *why* it predicted a certain output, and it will explain the logic step-by-step.
*   **Limitations:** It cannot ping real websites or access your local file system, as it lives entirely in the AI's imagination.

---

### 1. Getting Started
*   **Sign In**: Click the **User Icon** in the top right to sign in with your Google Account. This enables cloud sync, profile creation, and social features.
*   **API Key**: To use AI features (Generation, Chat, Live Voice), you must set your Google Gemini API Key.
    *   Go to **Menu (☰) -> Set API Key**.
    *   Paste your key from [Google AI Studio](https://aistudio.google.com/app/apikey).
    *   *Note: Your key is stored locally in your browser for privacy.*

### 2. Discover & Listen
*   **The Feed**: Browse existing channels by category (Tech, History, Philosophy, etc.).
*   **Lecture Player**: Click on a channel to view the **Curriculum**.
    *   **Select a Topic**: Click any lesson (e.g., "Chapter 1: Intro").
    *   **Generate Audio**: If the audio doesn't exist, click the **Lightning Bolt** button. The AI will write a script (Teacher/Student dialogue) and synthesize it.

### 3. Create Your Own Podcast
You don't need a microphone to be a creator here. You need an idea.

*   **🪄 Magic Voice Creator** (Recommended):
    1.  Click the **Magic** button in the header.
    2.  Click the Mic icon and **speak your idea** (e.g., *"I want a podcast about advanced Rust programming for C++ developers"*).
*   **📝 Manual / Import**:
    1.  Click **New Podcast (+)**.
    2.  **Paste a Document**: You can paste a PDF transcript, a lecture note, or a Wikipedia article.

### 4. ⚡ The Live Studio (Real-Time Voice)
This is the core differentiator. You can interrupt the podcast and talk to the host.

*   **Start a Session**: Click **"Start Live Chat"** on any channel page.
*   **Multimodal Vision**:
    *   **Screen Share**: Share your screen and let the AI review your code or diagrams.
    *   **Camera**: Show physical objects or whiteboards for analysis.

### 5. 💻 Code Studio (IDE)
A full-featured code editor with an embedded AI pair programmer.

*   **Access**: Click **Code Studio** in the navigation bar.
*   **AI Pair Programming**: Ask the AI to "Refactor this function" or "Fix the bug". The AI can edit your files directly.

### 6. 🎨 Whiteboard
A collaborative infinite canvas for systems design. Use it to draw architectures and let the AI explain or refine them.

### 7. 👥 Real-Time Collaboration
*   **Live Cursors**: See where other users are looking or typing.
*   **Follow Mode**: When the host switches files, everyone follows. Perfect for teaching.
`;

export const UserManual: React.FC<UserManualProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col">
      <div className="p-6 border-b border-slate-900 flex items-center gap-4 sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
            <Book size="20" className="text-indigo-400"/> User Guide
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="prose prose-invert prose-lg max-w-none">
                <MarkdownView content={MANUAL_CONTENT} />
            </div>
        </div>
      </div>
    </div>
  );
};