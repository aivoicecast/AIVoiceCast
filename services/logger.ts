
export type LogType = 'info' | 'success' | 'warn' | 'error';

/**
 * Neural Logger Service
 * Dispatches system-wide events that are captured by the Global Diagnostic Console in App.tsx
 */
export const logger = {
    info: (text: string) => dispatch('info', text),
    success: (text: string) => dispatch('success', text),
    warn: (text: string) => dispatch('warn', text),
    error: (text: string, error?: any) => {
        const errorMsg = error?.message || String(error || '');
        dispatch('error', `${text}${errorMsg ? `: ${errorMsg}` : ''}`);
    }
};

function dispatch(type: LogType, text: string) {
    window.dispatchEvent(new CustomEvent('neural-log', {
        detail: { text, type }
    }));
}
