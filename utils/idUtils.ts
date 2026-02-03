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
 * and circular references. This is the only 100% safe way to handle 
 * minified SDK internals (Firebase 'Y'/'Ka' constructors).
 */
function atomicClone(val: any, depth: number = 0, maxDepth: number = 4, seen = new WeakSet()): any {
    // 1. Primitives and Null
    if (val === null || typeof val !== 'object') {
        return val;
    }

    // 2. Depth Guard
    if (depth >= maxDepth) {
        return '[Deep Object Truncated]';
    }

    // 3. Circular Reference Guard
    if (seen.has(val)) {
        return '[Circular Ref Truncated]';
    }
    seen.add(val);

    // 4. Specialized Type Normalization
    if (val instanceof Date) return val.toISOString();
    if (val instanceof Error) return { message: val.message, name: val.name };
    if (val instanceof Blob || val instanceof File) return `[Binary Asset: ${val.constructor.name}(${(val as any).size} bytes)]`;
    if (ArrayBuffer.isView(val)) return `[TypedArray]`;

    // 5. Prototype Guard (Prune Instances/SDK Internals/DOM)
    const proto = Object.getPrototypeOf(val);
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
        return `[Instance: ${val.constructor?.name || 'Unknown'}]`;
    }

    // 6. Recursive Clone
    if (Array.isArray(val)) {
        return val.map(item => atomicClone(item, depth + 1, maxDepth, seen));
    }

    const result: any = {};
    try {
        for (const key in val) {
            if (Object.prototype.hasOwnProperty.call(val, key)) {
                // Filter dangerous or useless keys
                if (key.startsWith('_') || ['auth', 'app', 'firestore', 'storage', 'parent', 'window', 'document'].includes(key.toLowerCase())) {
                    result[key] = `[Filtered property: ${key}]`;
                    continue;
                }
                result[key] = atomicClone(val[key], depth + 1, maxDepth, seen);
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
        return `[Unserializable Artifact: ${err instanceof Error ? err.message : 'Unknown'}]`;
    }
}
