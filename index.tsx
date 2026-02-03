import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fix: App.tsx is at the root, not in components folder based on its internal relative imports
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);