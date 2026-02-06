
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
 * Manually clones objects to a maximum depth while stripping all non-serializable 
 * and circular references. Hardened for v8.0.0 to prevent circularity errors
 * from minified SDK internal constructors (like 'Y', 'Ka', etc).
 */
function atomicClone(val: any, depth: number = 0, maxDepth: number = 5, seen = new WeakSet()): any {
    // 1. Primitives and Null
    if (val === null || typeof val !== 'object') {
        return val;
    }

    // 2. DOM Node check - these are extremely circular and should never be serialized
    if (val instanceof Node || (typeof val === 'object' && 'nodeType' in val)) {
        return `[DOM_NODE: ${val.nodeName || 'Unknown'}]`;
    }

    // 3. Depth Guard
    if (depth >= maxDepth) {
        return '[Deep Object Truncated]';
    }

    // 4. Circular Reference Guard
    if (seen.has(val)) {
        return '[Circular Ref Truncated]';
    }
    
    // Register as seen for circular check early before any recursive traversal
    seen.add(val);

    // 5. Specialized Type Normalization
    if (val instanceof Date) return val.toISOString();
    if (val instanceof Error) return { message: val.message, name: val.name, stack: val.stack?.substring(0, 200) };
    if (val instanceof Blob || val instanceof File) return `[Binary Asset: ${val.constructor.name}(${(val as any).size} bytes)]`;
    if (ArrayBuffer.isView(val)) return `[TypedArray]`;
    if (val instanceof ArrayBuffer) return `[ArrayBuffer]`;

    // 6. Prototype Guard (Prune Instances/SDK Internals/DOM)
    // Only allow plain objects {} and arrays []
    const toStringTag = Object.prototype.toString.call(val);
    const isPlainObject = toStringTag === '[object Object]';
    const isArray = Array.isArray(val);

    // Hardened check for Firebase/GCP minified internal constructors (Y, Ka, Ra, etc.)
    const constructorName = val.constructor?.name;
    const isInternalInstance = constructorName && (
        constructorName === 'Y' || 
        constructorName === 'Ka' || 
        constructorName === 'Ra' || 
        constructorName === 'Fa' ||
        constructorName === 'Va'
    );

    if ((!isPlainObject && !isArray) || isInternalInstance) {
        return `[Instance: ${constructorName || 'Unknown'}]`;
    }

    // 7. Recursive Clone
    if (isArray) {
        return val.map(item => atomicClone(item, depth + 1, maxDepth, seen));
    }

    const result: any = {};
    try {
        // Use Object.keys to only iterate over own enumerable properties
        const keys = Object.keys(val);
        for (const key of keys) {
            const lowerKey = key.toLowerCase();
            // Blacklisted keys that often cause circularity or contain sensitive/large internal state
            if (key.startsWith('_') || 
                ['auth', 'app', 'firestore', 'storage', 'parent', 'window', 'document', 'navigator', 'location', 'client', 'session', 'src', 'target'].includes(lowerKey)) {
                result[key] = `[Filtered: ${key}]`;
                continue;
            }
            
            // Try to get value safely to avoid triggering side-effect getters that might crash
            try {
                result[key] = atomicClone(val[key], depth + 1, maxDepth, seen);
            } catch (e) {
                result[key] = '[Access Error]';
            }
        }
    } catch (e) {
        return '[Serialization Access Error]';
    }
    return result;
}

/**
 * Universal Robust Safe Stringifier:
 * Uses manual atomic cloning to ensure NO circular structures ever reach JSON.stringify.
 */
export function safeJsonStringify(obj: any, indent: number = 2): string {
    try {
        // We clone first, then stringify the guaranteed safe clone.
        const safeObj = atomicClone(obj);
        return JSON.stringify(safeObj, null, indent);
    } catch (err) {
        // Final fallback if the clone logic itself fails - MUST return valid JSON string
        return JSON.stringify({
            error: "Unserializable Artifact",
            message: err instanceof Error ? err.message : "Internal Logic Fault"
        });
    }
}
