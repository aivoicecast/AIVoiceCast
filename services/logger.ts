
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
}

/**
 * Neural Logger Service (v12.0.0-TELEMETRY)
 * Dispatches high-fidelity system telemetry to the Diagnostic Console.
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
    window.dispatchEvent(new CustomEvent('neural-log', {
        detail: { text, type, meta }
    }));
}
