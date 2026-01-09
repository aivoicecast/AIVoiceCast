import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/**
 * GLOBAL ERROR TRAP
 * If the app crashes before React can even render, show a diagnostic overlay.
 */
const renderGlobalCrash = (error: any, type: string) => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="background:#020617; color:#f8fafc; font-family:monospace; padding:40px; height:100vh; display:flex; flex-direction:column; gap:20px;">
        <div style="color:#ef4444; font-weight:bold; font-size:24px; border-bottom:1px solid #1e293b; padding-bottom:10px;">
          CRITICAL_SYSTEM_FAILURE: ${type}
        </div>
        <div style="background:#0f172a; padding:20px; border-radius:12px; border:1px solid #ef444455; overflow:auto;">
          <p style="color:#ef4444; margin:0 0 10px 0;">Error message: ${error?.message || 'Unknown Error'}</p>
          <pre style="color:#94a3b8; font-size:12px; margin:0;">${error?.stack || 'No stack trace available.'}</pre>
        </div>
        <div style="color:#6366f1; font-size:14px;">
          Possible causes:<br/>
          - Firebase configuration error (Check services/private_keys.ts)<br/>
          - Import map resolution failure (Check network tab for esm.sh status)<br/>
          - API Key environment variable missing (check process.env.API_KEY)
        </div>
        <button onclick="window.location.reload()" style="background:#6366f1; color:white; border:none; padding:12px 24px; border-radius:8px; font-weight:bold; cursor:pointer; width:fit-content; margin-top:10px;">
          Force System Reboot
        </button>
      </div>
    `;
  }
};

window.onerror = (message, source, lineno, colno, error) => {
  console.error("Global Catch:", error);
  renderGlobalCrash(error || { message }, 'RUNTIME_ERROR');
};

window.onunhandledrejection = (event) => {
  console.error("Promise Rejected:", event.reason);
  renderGlobalCrash(event.reason, 'UNHANDLED_PROMISE_REJECTION');
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (err) {
  renderGlobalCrash(err, 'REACT_MOUNT_FAILURE');
}
