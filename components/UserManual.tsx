
import React from 'react';
import { ArrowLeft, Book } from 'lucide-react';
import { MarkdownView } from './MarkdownView';

interface UserManualProps {
  onBack: () => void;
}

// Content extracted from README.md
const MANUAL_CONTENT = `
# 🎙️ AIVoiceCast User Guide

**The world's first decentralized, AI-native interactive knowledge community.**

AIVoiceCast is not just a podcast player. It is a **Generative Knowledge Engine**. Unlike Spotify or Apple Podcasts where you consume static audio, AIVoiceCast generates custom curriculums, synthesizes lectures on-demand, and allows you to **talk back** to the host in real-time.

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
    *   **Playback**: Use the player controls to listen. You can switch between **Neural Voices** (High Quality) and **System Voices** (Free/Unlimited) in the settings icon.

### 3. Create Your Own Podcast
You don't need a microphone to be a creator here. You need an idea.

*   **🪄 Magic Voice Creator** (Recommended):
    1.  Click the **Magic** button in the header.
    2.  Click the Mic icon and **speak your idea** (e.g., *"I want a podcast about advanced Rust programming for C++ developers"*).
    3.  The AI will design the title, cover art, host persona, and full 10-chapter curriculum automatically.
*   **📝 Manual / Import**:
    1.  Click **New Podcast (+)**.
    2.  **Paste a Document**: You can paste a PDF transcript, a lecture note, or a Wikipedia article. The AI will parse it and structure it into a learning path.

### 4. ⚡ The Live Studio (Real-Time Voice)
This is the core differentiator. You can interrupt the podcast and talk to the host.

*   **Start a Session**: Click **"Start Live Chat"** on any channel page.
*   **Voice Mode**: Have a fluid, low-latency conversation. Ask clarifying questions about the lecture you just heard.
*   **Multimodal Vision**:
    *   **Screen Share**: Click the Monitor icon to share your screen. The AI can see your code, slides, or diagrams and give feedback.
    *   **Camera**: Click the Video icon to show physical objects or whiteboards.
*   **Meeting Recorder**:
    *   In the "My Recordings" tab, click **Record Meeting**.
    *   Choose **"Silent Scribe"** mode. The AI will listen to your human meeting and generate a transcript + summary without speaking.
    *   Choose **"Translator"** mode to have the AI translate spoken words into another language in real-time.

### 5. 💻 Code Studio (IDE)
A full-featured code editor with an embedded AI pair programmer.

*   **Access**: Click **Code Studio** in the navigation bar.
*   **Projects**: Load a template (e.g., C++, Python) or import a **GitHub Repository**.
*   **AI Tools**:
    *   **Chat**: Ask the AI to "Refactor this function" or "Fix the bug".
    *   **Direct Editing**: The AI has permission to *edit your file directly*. It can rewrite code blocks for you.

### 6. 🎨 Whiteboard
A collaborative infinite canvas for systems design.

*   **Tools**: Draw rectangles, arrows, text, and freehand sketches.
*   **AI Analysis**: Ask the AI to generate diagrams or explain visuals drawn on the board.

### 7. 👥 Real-Time Collaboration
Work together with peers or mentors in Code Studio and Whiteboard.

*   **Sharing a Session**:
    1. Click the **Share** button in the top toolbar.
    2. Choose **Anyone with Link** for public sharing, or **Restricted** to invite specific members.
    3. Restricted invites appear in the recipient's **Notifications** (Bell Icon) and **Direct Messages**.
*   **Synchronized Features**:
    *   **Real-Time Typing**: See code changes as they happen.
    *   **Live Cursors**: See where other users are looking or typing, labeled with their name.
    *   **Follow Mode**: When the session host switches files in Code Studio, all viewers automatically switch to the same file. This is ideal for teaching or presentations.
*   **Security**:
    *   Edit access is controlled via a unique secure token in the shared link (\`&key=...\`).
    *   Read-only participants can view the session but cannot type or draw.

### 8. 🤝 Community & Career
*   **Mentorship Hub**:
    *   **Book AI**: Schedule a deep-dive session with an AI expert persona.
    *   **Book Humans**: Find real community members and book P2P learning sessions.
*   **Groups**: Create private study groups (e.g., "React Learners").
*   **Career Center**:
    *   **Job Board**: Post or find jobs.
    *   **Talent Pool**: Upload your resume to be discovered by others.
`;

export const UserManual: React.FC<UserManualProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
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
