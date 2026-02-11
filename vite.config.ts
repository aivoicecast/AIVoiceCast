
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fix: Cast process to any to avoid "Property 'cwd' does not exist on type 'Process'" error in certain environments where Node types are not globally available
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // This shim allows the code to access the API key via process.env.API_KEY
      // as required by the Neural Prism SDK guidelines.
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || '')
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/openclaw-api': {
          target: 'http://localhost:18792',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/openclaw-api/, '')
        }
      }
    }
  };
});
