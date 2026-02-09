
import { safeJsonStringify } from '../utils/idUtils';

export type LogType = 'info' | 'success' | 'warn' | 'error' | 'shadow' | 'audit' | 'input' | 'output' | 'trace';

export interface LogMetadata {
    category?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    inputSizeBytes?: number;
    outputSizeBytes?: number;
    latency?: number;
    nodeId?: string;
    retryCount?: number;
    preBalance?: number;
    postBalance?: number;
    totalTokens?: number;
    [key: string]: any; 
}

/**
 * Neural Logger Service (v12.5.0-TRACE)
 * Dispatches high-fidelity system telemetry to the Diagnostic Console.
 * Hardened with proactive circularity auditing.
 */
export const logger = {
    info: (text: string, meta?: LogMetadata) => dispatch('info', text, meta),
    success: (text: string, meta?: LogMetadata) => dispatch('success', text, meta),
    warn: (text: string, meta?: LogMetadata) => dispatch('warn', text, meta),
    error: (text: string, error?: any, meta?: LogMetadata) => {
        const errorMsg = error?.message || String(error || '');
        dispatch('error', `${text}${errorMsg ? `: ${errorMsg}` : ''}`, meta);
    },
    shadow: (text: string, meta?: LogMetadata) => dispatch('shadow', text, meta),
    audit: (text: string, meta?: LogMetadata) => dispatch('audit', text, meta),
    input: (text: string, meta?: LogMetadata) => dispatch('input', text, meta),
    output: (text: string, meta?: LogMetadata) => dispatch('output', text, meta),
    trace: (text: string, meta?: LogMetadata) => dispatch('trace', text, meta)
};

function dispatch(type: LogType, text: string, meta?: LogMetadata) {
    let safeMeta = null;
    if (meta) {
        try {
            // PROACTIVE AUDIT: 
            // safeJsonStringify will now handle circular objects gracefully 
            // and log specific paths to the console.
            const stringified = safeJsonStringify(meta);
            safeMeta = JSON.parse(stringified);
            
            // Check for circular reference indicators inserted by atomicClone
            if (stringified.includes('[Circular_Ref')) {
                window.dispatchEvent(new CustomEvent('neural-log', {
                    detail: { 
                        text: `[TRAP] Circular dependency neutralized in ${meta.category || 'unknown'} metadata. Check dev console for path trace.`, 
                        type: 'warn', 
                        meta: { category: 'DEBUG_AUDIT' } 
                    }
                }));
            }
        } catch (e) {
            safeMeta = { 
                error: "Metadata sanitization failure", 
                keys: Object.keys(meta).slice(0, 10),
                constructor: meta.constructor?.name 
            };
        }
    }

    window.dispatchEvent(new CustomEvent('neural-log', {
        detail: { text, type, meta: safeMeta }
    }));
}
