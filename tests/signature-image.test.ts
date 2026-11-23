import { describe, expect, it } from "vitest";

import { decodeSignaturePng } from "@/lib/signature-image";

/** The eight bytes every PNG starts with. */
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function dataUrl(bytes: Buffer) {
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

describe("decoding a drawn signature", () => {
  it("accepts a real PNG data url", () => {
    const decoded = decodeSignaturePng(dataUrl(PNG_HEADER));
    expect(decoded).not.toBeNull();
    expect(Buffer.from(decoded!).subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it("refuses anything that is not a png data url", () => {
    for (const value of [
      "",
      "not a data url",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "data:text/html;base64,PGgxPmhpPC9oMT4=",
      "javascript:alert(1)",
      "https://example.com/signature.png",
    ]) {
      expect(decodeSignaturePng(value)).toBeNull();
    }
  });

  // The prefix can say PNG while the bytes say something else, so the bytes
  // are what gets checked.
  it("refuses bytes that are not actually a png", () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    expect(decodeSignaturePng(dataUrl(html))).toBeNull();
  });

  it("refuses an image too large to be a signature", () => {
    const huge = Buffer.concat([PNG_HEADER, Buffer.alloc(2_000_001)]);
    expect(decodeSignaturePng(dataUrl(huge))).toBeNull();
  });

  it("refuses a truncated png", () => {
    expect(decodeSignaturePng(dataUrl(PNG_HEADER.subarray(0, 4)))).toBeNull();
  });
});
