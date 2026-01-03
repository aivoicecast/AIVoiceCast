# 🎙️ AIVoiceCast Platform

**The world's first decentralized, AI-native interactive knowledge community.**

AIVoiceCast is not just a podcast player. It is a **Generative Knowledge Engine**. Unlike Spotify or Apple Podcasts where you consume static audio, AIVoiceCast generates custom curriculums, synthesizes lectures on-demand, and allows you to **talk back** to the host in real-time.

---

## 🚀 The Neural Execution Engine

A unique feature of the AIVoiceCast Code Studio is its **Neural Execution Engine**. Unlike traditional online IDEs (like OnlineGDB or Coderbyte) that use heavy server-side Docker containers, we use **Heuristic Logic Simulation**.

### How it Works
When you click "Run", your code is not compiled into machine code. Instead, it is sent to **Gemini 3 Flash** with a specialized system instruction to act as a "Digital Twin" of a Linux terminal. The AI "traces" the logic of your code and predicts the standard output (stdout) and errors (stderr).

### Why Simulation?
*   **Security:** There is no risk of malicious code escaping a sandbox, because there is no sandbox. The code never actually "runs" on a real CPU.
*   **Infrastructure-Less:** We can "execute" any language (C++, Rust, Python, COBOL) instantly without installing 50+ different compilers.
*   **Socratic Feedback:** Because the execution is driven by an LLM, the "compiler" can actually explain its reasoning if you ask it in the chat.

---

## 📚 User Guide & Feature Manual

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
This is our flagship feature. At any point during a lecture, you can click **"Start Live Chat"** on any channel page.
*   **Voice-to-Voice:** Have a real-time, low-latency conversation with the AI host.
*   **Multimodal Vision:** The AI can "see." Share your **Screen** or **Camera** during the session, and the AI will analyze your code, diagrams, or environment in real-time.

### 5. 💻 Code Studio (Unified Workspace)
A full-featured Cloud IDE with an embedded AI pair programmer and multi-backend storage.

*   **Neural Execution:** Runs code via high-speed simulation using Gemini 3 Flash.
*   **Storage Backends**:
    *   **☁️ Private Cloud**: Uses Firebase Storage. Supports files and folders.
    *   **💾 Google Drive**: Connect your Google Drive to edit files directly.
    *   **🐙 GitHub**: Import public repositories or connect your account for private repos.
*   **Multi-User Collaboration**: Edit the same file simultaneously with visible cursors.

---

## ⚙️ Technical Setup (For Developers)

1.  **Private Keys**: Create `services/private_keys.ts` with your Firebase config.
2.  **Installation**: `npm install` and `npm start`.
3.  **AI engine**: Uses Google Gemini 3 Pro for reasoning and Gemini 3 Flash for execution simulation.