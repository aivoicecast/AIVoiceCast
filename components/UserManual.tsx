
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
*   **Socratic Debugging:** You can ask the AI *why* it predicted a certain output, and it will explain the logic step-by-step.

---

### 1. ⚡ The Live Studio (Real-Time Voice)
This is the core differentiator. You can interrupt the podcast and talk to the host.

*   **Start a Session**: Click **"Start Live Chat"** on any channel page.
*   **Multimodal Vision**:
    *   **Screen Share**: Share your screen and let the AI review your code or diagrams.
    *   **Camera**: Show physical objects or whiteboards for analysis.

#### 🛡️ Extended Session Stability
Recording a 30+ minute meeting? AIVoiceCast v4.2.2 includes **Neural Rotation**. 
*   Every 5 minutes, the link is refreshed to prevent idle-timeouts. 
*   You will see a brief "Refining Link" pulse; the AI will maintain perfect continuity of your conversation during this swap.
*   **Heartbeats:** The system sends silent signals every 15 seconds to keep the AI "awake" during long pauses.

---

### 2. Getting Started
*   **Sign In**: Click the **User Icon** in the top right to sign in with your Google Account. This enables cloud sync and social features.
*   **API Key**: To use AI features, you must set your Google Gemini API Key in the **Menu (☰) -> Set API Key**.

### 3. Discover & Listen
*   **The Feed**: Browse existing channels by category.
*   **Lecture Player**: Click on a channel to view the **Curriculum**.
    *   **Select a Topic**: Click any lesson.
    *   **Generate Audio**: Click the **Lightning Bolt** button if audio is missing.

### 4. Create Your Own Podcast
You don't need a microphone to be a creator here. You need an idea.

*   **🪄 Magic Voice Creator** (Recommended): Click the **Magic** button and speak your idea.
*   **📝 Manual / Import**: Click **New Podcast (+)** and paste a document or URL.

### 5. 💻 Code Studio (IDE)
A full-featured code editor with an embedded AI pair programmer.
*   **AI Pair Programming**: Ask the AI to "Refactor this function" or "Fix the bug".

### 6. 🎨 Whiteboard
A collaborative infinite canvas for systems design. Draw architectures and let the AI analyze them.
`;

export const UserManual: React.FC<UserManualProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-slate-950 flex flex-col">
      <div className="p-6 border-b border-slate-800 flex items-center gap-4 sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
            <Book size="20" className="text-indigo-400"/> User Guide
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#fdfbf7] text-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
            <div className="prose prose-slate prose-lg max-w-none antialiased text-slate-800">
                <MarkdownView content={MANUAL_CONTENT} />
            </div>
        </div>
      </div>
    </div>
  );
};
