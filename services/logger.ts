import { safeJsonStringify } from '../utils/idUtils';

export type LogType = 'info' | 'success' | 'warn' | 'error' | 'shadow' | 'audit' | 'input' | 'output' | 'trace' | 'loop';

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
    machineContent?: any; // Strictly for AI-to-AI handshake
    senderTool?: string;
    receiverTool?: string;
    topic?: string;
    hash?: string;
    [key: string]: any; 
}

/**
 * Neural Logger Service (v12.9.5-TELEMETRY)
 * Dispatches high-fidelity system telemetry and Machine Interface Protocol (MIP) logs.
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
    trace: (text: string, meta?: LogMetadata) => dispatch('trace', text, meta),
    loop: (text: string, meta?: LogMetadata) => dispatch('loop', text, meta)
};

function dispatch(type: LogType, text: string, meta?: LogMetadata) {
    let safeMeta = null;
    if (meta) {
        try {
            // High-fidelity clone to ensure metadata isn't stripped by environment limits
            const stringified = safeJsonStringify(meta);
            safeMeta = JSON.parse(stringified);
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