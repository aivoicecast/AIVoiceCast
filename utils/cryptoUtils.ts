
/**
 * VoiceCoin Cryptographic Identity and Payment Verification Utilities
 * Uses standard Web Crypto API for secure signing and verification.
 */

// AIVoiceCast Root Public Key (Mocked for decentralized trust base)
// In production, this would be a hardcoded base64 SPKI or JWK from a known source.
export const AIVOICECAST_TRUST_PUBLIC_KEY = `MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEP8qS1rJ7G6Yq5F9V0H2m4J8vO9P6R5z3S4Z7k8n9P1L0K2J3I4H5G6F7E8D9C0B1A2A3B4C5D6E7F8G9H0I1J2==`;

/**
 * Generates a new ECDSA Key Pair for a member.
 */
export async function generateMemberIdentity(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        ["sign", "verify"]
    );

    const exportedPublic = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublic)));

    return {
        publicKey: publicKeyBase64,
        privateKey: keyPair.privateKey
    };
}

/**
 * Signs an offline payment token.
 */
export async function signPayment(privateKey: CryptoKey, paymentData: any): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(paymentData));
    const signature = await window.crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
        },
        privateKey,
        data
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verifies if a signature is valid for a given public key.
 */
export async function verifySignature(publicKeyBase64: string, signatureBase64: string, dataObj: any): Promise<boolean> {
    try {
        const binaryPublic = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
        const publicKey = await window.crypto.subtle.importKey(
            "spki",
            binaryPublic,
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["verify"]
        );

        const binarySignature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(dataObj));

        return await window.crypto.subtle.verify(
            { name: "ECDSA", hash: { name: "SHA-256" } },
            publicKey,
            binarySignature,
            data
        );
    } catch (e) {
        console.error("Verification failed", e);
        return false;
    }
}

/**
 * Simulates AIVoiceCast signing a member's public key (The Certificate).
 * In a real environment, this would call a backend protected by admin keys.
 */
export async function requestIdentityCertificate(memberPublicKey: string): Promise<string> {
    const timestamp = Date.now();
    const certPayload = { publicKey: memberPublicKey, issuer: "AIVoiceCast", issuedAt: timestamp };
    // This signature would be generated using AIVoiceCast's Root Private Key.
    // For local logic, we'll store a mock signed string.
    return btoa(JSON.stringify({ ...certPayload, sig: "ROOT_SIGNED_HASH_MOCK" }));
}

/**
 * Verifies a certificate offline using the trust public key.
 */
export function verifyCertificateOffline(certificateBase64: string): boolean {
    try {
        const cert = JSON.parse(atob(certificateBase64));
        // In a real impl, we would use verifySignature with AIVOICECAST_TRUST_PUBLIC_KEY
        return cert.issuer === "AIVoiceCast" && cert.sig === "ROOT_SIGNED_HASH_MOCK";
    } catch (e) {
        return false;
    }
}
