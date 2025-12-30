
import React, { useState, useEffect } from 'react';
import { X, Key, Save, Trash2, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdate: (hasKey: boolean) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeyUpdate }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'cleared'>('idle');

  useEffect(() => {
    if (isOpen) {
      const storedGemini = localStorage.getItem('gemini_api_key');
      if (storedGemini) setGeminiKey(storedGemini);
      
      const storedOpenAI = localStorage.getItem('openai_api_key');
      if (storedOpenAI) setOpenaiKey(storedOpenAI);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (geminiKey.trim()) localStorage.setItem('gemini_api_key', geminiKey.trim());
    else localStorage.removeItem('gemini_api_key');

    if (openaiKey.trim()) localStorage.setItem('openai_api_key', openaiKey.trim());
    else localStorage.removeItem('openai_api_key');

    setStatus('saved');
    onKeyUpdate(!!geminiKey.trim()); // Main app mostly cares about Gemini for logic
    setTimeout(() => {
        onClose();
        setStatus('idle');
    }, 1000);
  };

  const handleClear = () => {
    localStorage.removeItem('gemini_api_key');
    localStorage.removeItem('openai_api_key');
    setGeminiKey('');
    setOpenaiKey('');
    setStatus('cleared');
    onKeyUpdate(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Key className="text-indigo-400 w-5 h-5" />
            <span>API Keys</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-400">
            Configure keys to enable AI features. Keys are stored locally in your browser.
          </p>

          {/* Gemini Key */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
              <span>Google Gemini API Key</span>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-white flex items-center gap-1">Get Key <ExternalLink size={10}/></a>
            </label>
            <div className="relative">
              <input
                type={showGemini ? "text" : "password"}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-sm"
              />
              <button
                onClick={() => setShowGemini(!showGemini)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                {showGemini ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">Required for Chat, Curriculum Generation, and Gemini Voices.</p>
          </div>

          {/* OpenAI Key */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
              <span>OpenAI API Key (Optional)</span>
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-white flex items-center gap-1">Get Key <ExternalLink size={10}/></a>
            </label>
            <div className="relative">
              <input
                type={showOpenAI ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-mono text-sm"
              />
              <button
                onClick={() => setShowOpenAI(!showOpenAI)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                {showOpenAI ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">Enable high-quality OpenAI TTS voices (Alloy, Echo, etc).</p>
          </div>

          {status === 'saved' && (
            <div className="flex items-center space-x-2 text-emerald-400 text-sm bg-emerald-900/20 p-3 rounded-lg border border-emerald-900/50">
               <CheckCircle size={16} />
               <span>Keys saved successfully!</span>
            </div>
          )}
          
          {status === 'cleared' && (
            <div className="flex items-center space-x-2 text-amber-400 text-sm bg-amber-900/20 p-3 rounded-lg border border-amber-900/50">
               <AlertCircle size={16} />
               <span>Keys removed.</span>
            </div>
          )}

          <div className="flex space-x-3 pt-2">
             <button
               onClick={handleSave}
               className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2"
             >
               <Save size={18} />
               <span>Save Configuration</span>
             </button>
             
             <button
               onClick={handleClear}
               className="px-4 bg-slate-800 hover:bg-red-900/30 hover:text-red-400 text-slate-400 border border-slate-700 rounded-xl transition-colors"
               title="Remove All Keys"
             >
               <Trash2 size={18} />
             </button>
          </div>

        </div>
      </div>
    </div>
  );
};
