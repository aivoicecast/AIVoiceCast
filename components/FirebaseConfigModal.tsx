
import React, { useState, useEffect } from 'react';
import { X, Save, Database, AlertTriangle, CheckCircle, Flame, ExternalLink, ShieldAlert, RefreshCw, Activity, Search } from 'lucide-react';
import { getFirebaseDiagnostics } from '../services/firebaseConfig';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdate: (isConfigured: boolean) => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ isOpen, onClose, onConfigUpdate }) => {
  const [configJson, setConfigJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');
  const [diagnostics, setDiagnostics] = useState<any>(null);

  useEffect(() => {
      if (isOpen) {
          setDiagnostics(getFirebaseDiagnostics());
          const saved = localStorage.getItem('firebase_config');
          if (saved) setConfigJson(saved);
      }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      const parsed = JSON.parse(configJson);
      if (!parsed.apiKey || !parsed.projectId) {
        throw new Error("Invalid Config: Missing apiKey or projectId");
      }
      
      localStorage.setItem('firebase_config', JSON.stringify(parsed));
      setStatus('saved');
      onConfigUpdate(true);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (e: any) {
      setError(e.message || "Invalid JSON format. Ensure you copy the entire object { ... }");
    }
  };

  const handleClear = () => {
      if (confirm("Reset to default configuration? This will clear your custom keys from local storage.")) {
        localStorage.removeItem('firebase_config');
        window.location.reload();
      }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Flame className="text-amber-500 w-5 h-5" />
            <span>Firebase Status & Setup</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Diagnostics Section */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
             <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Activity size={14} className="text-indigo-400"/> System Diagnostics
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${diagnostics?.isInitialized ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
                    {diagnostics?.isInitialized ? 'INITIALIZED' : 'NOT INITIALIZED'}
                </span>
             </div>

             <div className="grid grid-cols-2 gap-3">
                 <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Source</p>
                    <p className="text-xs text-white capitalize font-mono">{diagnostics?.configSource || '...'}</p>
                 </div>
                 <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Project ID</p>
                    <p className="text-xs text-white truncate font-mono">{diagnostics?.projectId || 'Missing'}</p>
                 </div>
                 <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 col-span-2">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">API Key (Masked)</p>
                    <p className="text-xs text-indigo-300 font-mono">{diagnostics?.activeConfig?.apiKey || 'None'}</p>
                 </div>
             </div>

             {!diagnostics?.isInitialized && (
                 <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-900/20 p-2 rounded border border-amber-500/30">
                     <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
                     <p>Auth failed to start. This usually happens if the API Key is invalid or the domain is not whitelisted in Firebase Console.</p>
                 </div>
             )}
          </div>

          <div className="space-y-2 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
             <h4 className="text-xs font-bold text-slate-300 uppercase mb-2 flex items-center gap-2"><Search size={14}/> Setup Instructions</h4>
             <ol className="text-xs text-slate-400 space-y-2 list-decimal pl-4">
                <li>Go to <strong>Project Settings</strong> in the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1">Firebase Console <ExternalLink size={10}/></a>.</li>
                <li>Ensure <strong>Google Auth</strong> is enabled in the "Authentication" section.</li>
                <li>Add this domain to <strong>Settings > Authorized Domains</strong>.</li>
                <li>Copy the <code>firebaseConfig</code> JSON object and paste it below.</li>
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
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/10 p-3 rounded border border-red-900/30 text-center flex items-center justify-center gap-2">
               <ShieldAlert size={16} /> {error}
            </div>
          )}

          {status === 'saved' && (
            <div className="flex items-center justify-center space-x-2 text-emerald-400 text-sm bg-emerald-900/20 p-3 rounded-lg border border-emerald-900/50">
               <CheckCircle size={16} />
               <span>Settings Saved! Reloading...</span>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-4 shrink-0">
             <button onClick={handleClear} className="text-xs text-slate-500 hover:text-red-400 transition-colors underline font-medium">
                Reset to Default
             </button>
             <button
               onClick={handleSave}
               disabled={!configJson || status === 'saved'}
               className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
             >
               <Save size={18} />
               <span>Apply Changes</span>
             </button>
        </div>
      </div>
    </div>
  );
};
