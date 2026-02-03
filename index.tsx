import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// App.tsx is located in the components folder
import App from './components/App';

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