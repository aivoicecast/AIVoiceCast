
import React, { useState } from 'react';
import { X, Save, Database, AlertTriangle, CheckCircle, Flame, ExternalLink, ShieldAlert } from 'lucide-react';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdate: (isConfigured: boolean) => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ isOpen, onClose, onConfigUpdate }) => {
  const [configJson, setConfigJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      // Validate JSON
      const parsed = JSON.parse(configJson);
      if (!parsed.apiKey || !parsed.projectId) {
        throw new Error("Invalid Config: Missing apiKey or projectId");
      }
      
      localStorage.setItem('firebase_config', JSON.stringify(parsed));
      setStatus('saved');
      onConfigUpdate(true);
      
      // Force reload to apply new config to firebase.initializeApp
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (e: any) {
      setError(e.message || "Invalid JSON format");
    }
  };

  const handleClear = () => {
      localStorage.removeItem('firebase_config');
      window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Flame className="text-amber-500 w-5 h-5" />
            <span>Firebase Configuration</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-amber-900/10 border border-amber-900/30 p-4 rounded-lg flex items-start gap-3">
             <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
             <div className="text-sm text-amber-200/80">
                <p className="font-bold mb-1">Setup Required</p>
                <p>The app is running in "Safe Mode". To enable Sign In, Database, and Cloud Storage, you must provide your Firebase configuration.</p>
             </div>
          </div>

          <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-lg flex items-start gap-3">
             <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={18} />
             <div className="text-sm text-red-200/80">
                <p className="font-bold mb-1">Was your key leaked?</p>
                <p className="mb-2">If GitHub alerted you about a leaked key, you must <strong>revoke/delete</strong> it immediately in the Google Cloud Console.</p>
                <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-red-300 underline hover:text-white inline-flex items-center gap-1 font-bold"
                >
                  Manage Credentials <ExternalLink size={10}/>
                </a>
             </div>
          </div>

          <div className="space-y-2 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
             <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">How to get your config:</h4>
             <ol className="text-xs text-slate-400 space-y-2 list-decimal pl-4">
                <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1">Firebase Console <ExternalLink size={10}/></a>.</li>
                <li>Open your project -> <strong>Project Settings</strong> (Gear Icon).</li>
                <li>Scroll down to <strong>"Your apps"</strong>.</li>
                <li>Select the <strong>Web (&lt;/&gt;)</strong> app (or create one).</li>
                <li>Copy the <code>const firebaseConfig = &#123; ... &#125;;</code> object.</li>
                <li>Paste it below.</li>
             </ol>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Paste Config Object (JSON)
            </label>
            <textarea
              value={configJson}
              onChange={(e) => { setConfigJson(e.target.value); setError(null); }}
              placeholder={'{ "apiKey": "AIza...", "authDomain": "...", "projectId": "..." }'}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-4 text-xs font-mono text-indigo-100 focus:ring-2 focus:ring-indigo-500 outline-none h-32"
            />
            <p className="text-[10px] text-slate-500 text-right">
                Values are saved to LocalStorage.
            </p>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/10 p-2 rounded border border-red-900/30 text-center">
               {error}
            </div>
          )}

          {status === 'saved' && (
            <div className="flex items-center justify-center space-x-2 text-emerald-400 text-sm bg-emerald-900/20 p-3 rounded-lg border border-emerald-900/50">
               <CheckCircle size={16} />
               <span>Config saved! Reloading app...</span>
            </div>
          )}

          <div className="flex space-x-3 pt-2">
             <button
               onClick={handleSave}
               disabled={!configJson}
               className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
             >
               <Save size={18} />
               <span>Save & Reload</span>
             </button>
          </div>
          
          <div className="text-center pt-2">
             <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-300 underline">
                Reset / Clear Config
             </button>
          </div>

        </div>
      </div>
    </div>
  );
};
