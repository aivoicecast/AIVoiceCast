
/**
 * Generates a URL-safe, cryptographically secure 44-character ID.
 * Based on 32 bytes of randomness (256-bit), matching high-security document URI formats.
 */
export function generateSecureId(): string {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  
  // Convert to Base64
  let binary = '';
  const len = array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(array[i]);
  }
  
  // Use URL-safe base64: replace + with -, / with _, and remove padding =
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .substring(0, 44);
}

/**
 * Generates a content-derived UID for lectures based on topic, context, and language.
 * Enables global sharing of synthesized artifacts while maintaining cache integrity.
 */
export async function generateContentUid(topic: string, context: string, lang: string): Promise<string> {
    const data = `${topic}|${context}|${lang}`;
    const msgBuffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

/**
 * Deep Atomic Cloner:
 * Hardened to survive Google AI Studio and Firestore SDK internal heartbeats.
 * Proactively strips minified constructors (Y, Ka) and circular properties (src, i).
 */
function atomicClone(val: any, depth: number = 0, maxDepth: number = 4, path: string = 'root', seen = new WeakMap()): any {
    // 1. Primitives and Null
    if (val === null || typeof val !== 'object') {
        return typeof val === 'function' ? '[Function_Ref]' : val;
    }

    // 2. Circularity Detection via WeakMap (Applied early to references)
    if (seen.has(val)) {
        return `[Circular_Ref:${seen.get(val)}]`;
    }
    
    // 3. Early Constructor Check (The 'Y' and 'Ka' fix)
    let constructorName = '';
    try {
        constructorName = val.constructor?.name || '';
        // Aggressively block minified internal Google/Firebase constructors (standard 1-2 char names)
        if (constructorName === 'Y' || constructorName === 'Ka' || constructorName.length <= 2) {
            return `[Internal_SDK_Object:${constructorName}]`;
        }
    } catch (e) {
        return '[Unreadable_Constructor]';
    }

    // 4. Record occurrence
    seen.set(val, path);

    // 5. specialized built-ins
    if (val instanceof Date) return val.toISOString();
    if (val instanceof Error) return { name: val.name, message: val.message, stack: '[Redacted_Stack]' };
    if (val instanceof Node) return `[DOM_Node:${val.nodeName}]`;
    if (val instanceof Blob || val instanceof File) return `[Binary_Asset:${val.size}b]`;

    // 6. Recursion limit
    if (depth >= maxDepth) {
        return '[Object_Depth_Limit]';
    }

    // 7. Array processing
    if (Array.isArray(val)) {
        return val.map((v, i) => atomicClone(v, depth + 1, maxDepth, `${path}[${i}]`, seen));
    }

    // 8. Object processing
    const result: any = {};
    try {
        const keys = Object.keys(val);
        // Process only first 40 keys for efficiency/safety
        for (const key of keys.slice(0, 40)) {
            // PROACTIVE PROPERTY BLACKLIST:
            // 'i' and 'src' are the specific properties reported in the circular structure error.
            if (key === 'src' || key === 'i' || key === 'parent' || key === 'window' || key === 'context' || key === 'target') {
                result[key] = '[Filtered_Internal_Prop]';
                continue;
            }
            
            // Skip private/internal properties
            if (key.startsWith('_') || key.startsWith('$')) {
                continue;
            }

            try {
                result[key] = atomicClone(val[key], depth + 1, maxDepth, `${path}.${key}`, seen);
            } catch (err) {
                result[key] = '[Access_Fault]';
            }
        }
        if (keys.length > 40) {
            result['__trunc__'] = `${keys.length - 40} more keys`;
        }
    } catch (e) {
        return '[Iteration_Fault]';
    }
    return result;
}

/**
 * Universal Robust Safe Stringifier:
 * Uses manual atomic cloning to ensure NO circular structures ever reach JSON.stringify.
 */
export function safeJsonStringify(obj: any, indent: number = 2): string {
    try {
        const safeObj = atomicClone(obj, 0, 4, 'root', new WeakMap());
        return JSON.stringify(safeObj, null, indent);
    } catch (err) {
        console.error("[Neural Core] Critical Serialization Error", err);
        return JSON.stringify({
            error: "Unserializable Artifact",
            details: "Check console for circularity trace.",
            timestamp: Date.now()
        });
    }
}
