
// PlantUML Encoder
// Implements Deflate + Custom Base64 encoding required by plantuml.com

export async function encodePlantUML(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // 1. Compress using Deflate (Raw)
  // We use the browser's native CompressionStream.
  // Note: 'deflate-raw' is needed for PlantUML (no zlib headers), 
  // but it's only supported in newer browsers (Chrome 103+, FF 113+).
  // If not supported, this might fail or we need a fallback logic (which we skip for simplicity in this demo).
  let compressed: Uint8Array;
  
  try {
    const stream = new Blob([data]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream("deflate-raw"));
    const response = await new Response(compressedStream).arrayBuffer();
    compressed = new Uint8Array(response);
  } catch (e) {
    console.error("CompressionStream 'deflate-raw' not supported or failed", e);
    return ""; // Fallback or error state
  }

  // 2. Custom Base64 Encode
  return encode64(compressed);
}

// PlantUML specific Base64 mapping
// 0-9, A-Z, a-z, -, _
function encode6bit(b: number): string {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return '-';
  if (b === 1) return '_';
  return '?';
}

function encode64(data: Uint8Array): string {
  let r = "";
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) {
      r += append3bytes(data[i], data[i + 1], 0);
    } else if (i + 1 === data.length) {
      r += append3bytes(data[i], 0, 0);
    } else {
      r += append3bytes(data[i], data[i + 1], data[i + 2]);
    }
  }
  return r;
}

function append3bytes(b1: number, b2: number, b3: number): string {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return (
    encode6bit(c1 & 0x3f) +
    encode6bit(c2 & 0x3f) +
    encode6bit(c3 & 0x3f) +
    encode6bit(c4 & 0x3f)
  );
}
