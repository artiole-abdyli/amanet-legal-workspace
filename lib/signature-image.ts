const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const MAX_BYTES = 2_000_000;

/**
 * Turns the data URL a signature pad produces into bytes.
 *
 * The browser is not trusted here: the string has to match the exact shape of
 * a base64 PNG data URL, the decoded bytes have to start with the PNG
 * signature, and the image has to be small enough to be a signature rather
 * than a payload. Anything else returns null and the caller refuses.
 */
export function decodeSignaturePng(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;

  const bytes = Buffer.from(match[1], "base64");
  if (bytes.byteLength > MAX_BYTES) return null;
  if (bytes.length < 8) return null;
  if (PNG_MAGIC.some((byte, index) => bytes[index] !== byte)) return null;

  return new Uint8Array(bytes);
}
