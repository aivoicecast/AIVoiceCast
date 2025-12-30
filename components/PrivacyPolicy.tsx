
import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, Database, Server, Cloud, HardDrive, Github } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-6 border-b border-slate-900 flex items-center gap-4 sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
            <Shield size={20} className="text-emerald-400"/> Privacy Policy
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-10 text-slate-300 leading-relaxed">
            
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <p className="text-lg text-slate-200 font-medium">
                    AIVoiceCast operates on a hybrid storage model to maximize user control and privacy. Your data resides in one of four distinct locations depending on the feature you use.
                </p>
            </div>

            <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Database className="text-indigo-400"/> 1. Storage Backends</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-2"><HardDrive size={18} className="text-emerald-400"/> IndexedDB (Local Browser)</h3>
                        <p className="text-sm text-slate-400">
                            <strong>Scope:</strong> Private to your specific browser/device.<br/>
                            <strong>Data:</strong> Audio cache (generated TTS files), offline lecture scripts, unsaved channel drafts.<br/>
                            <strong>Privacy:</strong> Highest. This data never leaves your device unless you explicitly perform a "Cloud Sync" backup.
                        </p>
                    </div>

                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-2"><Cloud size={18} className="text-amber-400"/> Google Cloud (Firebase)</h3>
                        <p className="text-sm text-slate-400">
                            <strong>Scope:</strong> Centralized App Database.<br/>
                            <strong>Data:</strong> User profiles, Public channels, Team Chat history, Whiteboards, Private Cloud projects.<br/>
                            <strong>Privacy:</strong> Data is stored in the application owner's cloud account. While restricted from other users via security rules, it is visible to the application administrators for maintenance and moderation.
                        </p>
                    </div>

                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-2"><Server size={18} className="text-blue-400"/> Google Drive</h3>
                        <p className="text-sm text-slate-400">
                            <strong>Scope:</strong> Private to your Google Account.<br/>
                            <strong>Data:</strong> Code files edited in Code Studio (Drive Tab).<br/>
                            <strong>Privacy:</strong> High. We use the Google Drive API to read/write files *you* select. This data stays within your personal Google ecosystem; we do not copy it to our servers.
                        </p>
                    </div>

                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-2"><Github size={18} className="text-white"/> GitHub</h3>
                        <p className="text-sm text-slate-400">
                            <strong>Scope:</strong> Third-party Version Control.<br/>
                            <strong>Data:</strong> Code repositories imported into Code Studio.<br/>
                            <strong>Privacy:</strong> Determined by your GitHub repository settings (Public vs Private). We access this data using your personal access token, which is stored locally in your browser session.
                        </p>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Lock className="text-indigo-400"/> 2. Feature-Specific Data Handling</h2>
                
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">Team Chat & Groups</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-400">
                            <li><strong>Storage:</strong> Google Cloud (Firestore).</li>
                            <li><strong>Visibility:</strong> Messages in public channels (#general) are visible to all members. Messages in private groups are visible only to group members and app administrators.</li>
                            <li><strong>Direct Messages:</strong> Encrypted in transit and stored securely, but technically accessible by database administrators if required for legal compliance.</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">Blogs & Comments</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-400">
                            <li><strong>Storage:</strong> Google Cloud (Firestore).</li>
                            <li><strong>Visibility:</strong> Blog posts published to the "Community Blog" are <strong>Public</strong>. Comments are public. Drafts remain private to you (and admins).</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">Code Studio & Whiteboard</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-400">
                            <li><strong>Code Files:</strong> Stored based on the selected tab (Private Cloud, Drive, or GitHub). Live Session code is transient and stored in Firestore for the duration of the session.</li>
                            <li><strong>Whiteboards:</strong> Stored in Google Cloud (Firestore). If you generate a "Share Link", anyone with the link can access that specific whiteboard.</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">Podcast Content & Live Sessions</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-400">
                            <li><strong>Generated Audio:</strong> Stored locally in your browser (IndexedDB) to save bandwidth.</li>
                            <li><strong>Text Transcripts:</strong> Stored in Google Cloud (Firestore) to enable history and search.</li>
                            <li><strong>Live Chat History:</strong> The text transcript of your voice conversations with AI is saved to your account history (Firestore). You can delete these sessions at any time.</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-bold text-white mb-4">3. AI Processing</h2>
                <p>
                    This application uses <strong>Google Gemini API</strong> for generative capabilities.
                </p>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mt-4">
                    <p className="text-sm">
                        <span className="text-indigo-400 font-bold">Note:</span> Data sent to the AI (prompts, context, code snippets, voice input) is processed by Google. It falls under Google's API Data Privacy Policy. We do not use your data to train our own models, but Google may retain data for abuse monitoring (typically 30 days) depending on their terms.
                    </p>
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-bold text-white mb-4">4. User Rights</h2>
                <p>
                    You retain full ownership of the content you create (podcasts, code, documents). You can delete your account and all associated data at any time via the Settings menu.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold text-white mb-4">5. Contact</h2>
                <p>
                    For privacy concerns or data deletion requests, please contact us at <a href="mailto:privacy@aivoicecast.com" className="text-indigo-400 hover:underline">privacy@aivoicecast.com</a>.
                </p>
            </section>
            
            <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
                Last Updated: 12/13/2025
            </div>
        </div>
      </div>
    </div>
  );
};
