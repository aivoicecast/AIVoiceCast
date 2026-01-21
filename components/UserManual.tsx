
import React from 'react';
import { ArrowLeft, Book, Sparkles } from 'lucide-react';
import { MarkdownView } from './MarkdownView';

interface UserManualProps {
  onBack: () => void;
}

const MANUAL_CONTENT = `
# 🌈 Neural Prism: Your Daily AI Hub

**Making the world's most powerful AI super-intelligence simple for everyone.**

Neural Prism is not just a platform; it is a lens. We take the complex capabilities of Google Gemini 3 and turn them into a spectrum of **20+ specialized tools** that help you with your daily activities—from building projects to organizing your life.

---

### 🪄 The Vision: AI for Daily Life
Forget complex command prompts. Our tools are designed for real-world tasks:
- **Finance Hub**: Design verified checks and manage neural assets.
- **Logistics Lab**: Create professional shipping labels with neural address parsing.
- **Gift Workshop**: Speak your wish and generate a unique holiday card with custom music.
- **Career Hub**: Get evaluated by an AI interviewer or find a human mentor.

---

### 1. ⚡ Interactive Guides (Knowledge Hub)
Instead of static podcasts, interact with guides who know everything about their topic.
*   **Ask Anything**: You can interrupt the guide at any time and have a natural conversation.
*   **Visual Aid**: Share your screen or camera. The guide can "see" what you are working on and provide instant feedback.

---

### 2. 🏗️ Builder Studio (Builder's Paradise)
Create software or write documents with an AI pair-partner.
*   **Neural Simulation**: Run code instantly. Instead of using real servers, we use "Imagination" (Neural Simulation) to predict the outcome safely and quickly.
*   **Collaboration**: Invite friends to your studio and work together in real-time.

---

### 3. 🎨 Visual Labs
*   **Brand Lab**: Generate professional app icons from simple descriptions.
*   **Visual Canvas**: A collaborative infinite whiteboard for mapping out your ideas.

---

### 4. 📂 Getting Started
*   **Sign In**: Use your Google Account for seamless sync. Everything you do is saved to your personal Google Drive for privacy.
*   **The Magic Button**: Not sure where to start? Click the **Neural Magic** button and just *speak* your goal. We'll find the right tool for you.

---

### 🚀 Join the Spectrum
Neural Prism is built to grow. As a member, you can contribute new tools and activities to the hub, helping us expand the spectrum of human potential.

---
**Platform Version:** v5.6.0
`;

export const UserManual: React.FC<UserManualProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-slate-950 flex flex-col">
      <div className="p-6 border-b border-slate-800 flex items-center gap-4 sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
            < Book size="20" className="text-indigo-400"/> Activity Manual
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
