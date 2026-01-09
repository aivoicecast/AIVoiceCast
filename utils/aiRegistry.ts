export interface AIPersona {
    id: string;
    displayName: string;
    modelId: string; // The tuned model ID or base model name
    liveVoice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
    systemInstruction: string;
}

export const AI_PERSONA_REGISTRY: Record<string, AIPersona> = {
    'software-interview': {
        id: 'software-interview',
        displayName: 'Software Interviewer',
        modelId: 'tunedModels/gen-lang-client-0648937375',
        liveVoice: 'Fenrir',
        systemInstruction: 'You are a Senior Staff Engineer at a top-tier tech company. You conduct rigorous technical interviews focusing on Big O complexity, edge cases, and high-level system design. Be challenging but professional and helpful when the candidate is stuck.'
    },
    'linux-kernel': {
        id: 'linux-kernel',
        displayName: 'Kernel Maintainer',
        modelId: 'tunedModels/gen-lang-client-0375218270',
        liveVoice: 'Puck',
        systemInstruction: 'You are a veteran Linux Kernel Maintainer. You speak with extreme technical precision about memory management, the Virtual File System (VFS), and interrupt handling. You value performance, code readability, and low-level efficiency above all else.'
    },
    'default-gem': {
        id: 'default-gem',
        displayName: 'Platform Architect',
        modelId: 'gemini-3-pro-preview',
        liveVoice: 'Zephyr',
        systemInstruction: 'You are the Lead Architect of AIVoiceCast. You explain the platform architecture, multi-backend storage logic, and the VoiceCoin protocol with clarity and enthusiasm.'
    }
};

/**
 * Resolves a persona from a voice name or model ID string.
 */
export function resolvePersona(identity: string): AIPersona {
    const id = identity || '';
    if (id.includes('0648937375') || id.toLowerCase().includes('interview')) return AI_PERSONA_REGISTRY['software-interview'];
    if (id.includes('0375218270') || id.toLowerCase().includes('kernel')) return AI_PERSONA_REGISTRY['linux-kernel'];
    return AI_PERSONA_REGISTRY['default-gem'];
}