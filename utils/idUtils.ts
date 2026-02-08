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
 * and circular references. Hardened for v9.8.0 with aggressive minified 
 * constructor scrubbing (Y, Ka, Ra, etc.) to prevent circular JSON errors.
 */
function atomicClone(val: any, depth: number = 0, maxDepth: number = 4, seen = new WeakSet()): any {
    // 1. Primitives and Null
    if (val === null || typeof val !== 'object') {
        return val;
    }

    // 2. Circular Reference Guard
    if (seen.has(val)) {
        return '[Circular_Ref]';
    }
    
    // 3. Register as seen early
    try {
        seen.add(val);
    } catch (e) {
        return '[Ref_Locked]';
    }

    // 4. DOM Node check (Always dangerous for JSON)
    if (val instanceof Node || (typeof val === 'object' && 'nodeType' in val)) {
        return `[DOM_NODE: ${val.nodeName || 'Unknown'}]`;
    }

    // 5. Depth Guard
    if (depth >= maxDepth) {
        return '[Object_Depth_Limit]';
    }

    // 6. Specialized Type Normalization
    if (val instanceof Date) return val.toISOString();
    if (val instanceof Error) return { message: val.message, name: val.name, stack: val.stack?.substring(0, 200) };
    if (val instanceof Blob || val instanceof File) return `[Binary: ${val.constructor.name}(${(val as any).size} bytes)]`;
    if (ArrayBuffer.isView(val)) return `[TypedArray]`;
    if (val instanceof ArrayBuffer) return `[ArrayBuffer]`;

    // 7. Prototype/Internal SDK Instance Guard
    // CRITICAL FIX: Aggressively scrub minified constructors (1-2 chars) which 
    // are common in Google/Firebase obfuscated SDKs and often close circular loops.
    const constructorName = val.constructor?.name;
    const isObfuscated = constructorName && constructorName.length <= 2;
    const isSdkInternal = constructorName && (
        constructorName.includes('Firebase') ||
        constructorName.includes('Google') ||
        constructorName.includes('Firestore') ||
        constructorName === 'Y' || 
        constructorName === 'Ka' || 
        constructorName === 'Ra'
    );

    if (isObfuscated || isSdkInternal) {
        return `[Internal_SDK_Object: ${constructorName || 'Anonymous'}]`;
    }

    // 8. Recursive Clone
    if (Array.isArray(val)) {
        return val.map(item => atomicClone(item, depth + 1, maxDepth, seen));
    }

    const result: any = {};
    try {
        const keys = Object.keys(val);
        // Safety limit on number of properties to clone per level
        const propertyLimit = 50;
        const keysToProcess = keys.slice(0, propertyLimit);

        for (const key of keysToProcess) {
            const lowerKey = key.toLowerCase();
            // Aggressive blacklist for properties that frequently point to complex, circular SDK objects
            const isCircularProp = ['src', 'target', 'i', 'v', 'g', 'u', 'client', 'app', 'auth', 'firestore', 'storage', 'parent', 'window', 'document'].includes(lowerKey);
            const isInternalProp = key.startsWith('_');
            
            if (isCircularProp || isInternalProp) {
                result[key] = `[Filtered_Property: ${key}]`;
                continue;
            }
            
            try {
                const subVal = (val as any)[key];
                result[key] = atomicClone(subVal, depth + 1, maxDepth, seen);
            } catch (e) {
                result[key] = '[Access_Fault]';
            }
        }
        
        if (keys.length > propertyLimit) {
            result['__truncated__'] = `[Truncated ${keys.length - propertyLimit} additional keys]`;
        }
    } catch (e) {
        return '[Scrub_Failure]';
    }
    return result;
}

/**
 * Universal Robust Safe Stringifier:
 * Uses manual atomic cloning to ensure NO circular structures ever reach JSON.stringify.
 */
export function safeJsonStringify(obj: any, indent: number = 2): string {
    try {
        const safeObj = atomicClone(obj);
        return JSON.stringify(safeObj, null, indent);
    } catch (err) {
        return JSON.stringify({
            error: "Unserializable Artifact",
            message: err instanceof Error ? err.message : "Internal Logic Fault"
        });
    }
}
