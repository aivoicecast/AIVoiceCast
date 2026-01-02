
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
