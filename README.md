
# 🎙️ AIVoiceCast Platform

**The world's first decentralized, AI-native interactive knowledge community.**

AIVoiceCast is not just a podcast player. It is a **Generative Knowledge Engine**. Unlike Spotify or Apple Podcasts where you consume static audio, AIVoiceCast generates custom curriculums, synthesizes lectures on-demand, and allows you to **talk back** to the host in real-time.

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
*   **Meeting Recorder:**
    *   In the "My Recordings" tab, click **Record Meeting**.
    *   Choose **"Silent Scribe"** mode. The AI will listen to your human meeting and generate a transcript + summary without speaking.
    *   Choose **"Translator"** mode to have the AI translate spoken words into another language in real-time.

### 5. 💻 Code Studio (Unified Workspace)
A full-featured Cloud IDE with an embedded AI pair programmer and multi-backend storage.

*   **Storage Backends**:
    *   **☁️ Private Cloud**: Uses Firebase Storage. Supports files and folders. Ideal for persistent projects.
    *   **💾 Google Drive**: Connect your Google Drive to edit files directly. No download required.
    *   **🐙 GitHub**: Import public repositories or connect your account to browse private repos.
    *   **🔴 Live Session**: Ephemeral storage for collaborative coding during a call.
*   **AI Tools**:
    *   **Chat**: Ask the AI to "Refactor this function" or "Fix the bug".
    *   **Direct Editing**: The AI has permission to *edit your file directly* using function calling tools.
*   **Multi-User Collaboration**:
    *   Click **Share** to generate a link.
    *   Send it to a friend. You can both edit the same file simultaneously (Google Docs style) with visible cursors.

### 6. 🎨 Whiteboard
A collaborative infinite canvas for systems design.

*   **Tools**: Draw rectangles, arrows, text, and freehand sketches. Supports various brush types (Pencil, Marker, Airbrush).
*   **Sharing**: Create read-only or edit links to collaborate with peers in real-time.

### 7. 🏢 Workplace Chat
A Slack-like communication hub for your teams.
*   **Channels**: Join public channels (#general, #announcements).
*   **Groups**: Communicate within your private study groups.
*   **Direct Messages**: Message any user on the platform privately.
*   **File Sharing**: Upload images, videos, and documents securely.

### 8. 💼 Career Center
Connect your learning journey to real-world opportunities.
*   **Job Board**: Browse openings posted by the community or partner companies.
*   **Talent Pool**: Create a profile, upload your resume, and tag your skills to be discovered by recruiters.
*   **Mentorship Application**: Apply to become a verified Mentor or Domain Expert on the platform.

---

## ⚙️ Technical Setup (For Developers)

If you are forking or running this code locally, follow these steps to configure the environment.

### 1. Private Keys
The file `services/private_keys.ts` is ignored by Git for security. You must create it manually.

1.  Go to `services/` folder.
2.  Create `private_keys.ts`.
3.  Paste the following:

```typescript
// services/private_keys.ts
export const firebaseKeys = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123",
  appId: "1:123:web:abc",
  measurementId: "G-XYZ"
};

// Optional: Default Gemini Key for all users (Not recommended for public deployment)
export const GEMINI_API_KEY = ""; 
```

### 2. Installation
```bash
npm install
npm start
```

### 3. Architecture Notes
*   **Frontend**: React 19, Tailwind CSS.
*   **State**: LocalStorage + Context + Refs (No Redux).
*   **Database**:
    *   **Firestore**: Public channels, User profiles, Social graph, Chat Messages.
    *   **IndexedDB**: Local cache for Audio Blobs and Lecture Scripts (Offline-first).
    *   **Cloud Storage**: User assets, Code Studio files, Meeting recordings.
*   **AI**: Google Gemini Pro (Logic) + Gemini Flash (Speed) + Gemini Live (Voice).
