import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { stampSignature } from "@/lib/pdf/sign";

/** A 1x1 transparent PNG, the smallest thing pdf-lib will embed. */
const PNG = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

async function sourcePdf(pages = 1) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) {
    pdf.addPage([595.28, 841.89]);
  }
  return pdf.save();
}

const signer = {
  signerName: "Ana Berisha",
  signerEmail: "ana.berisha@example.com",
  signedAt: new Date("2026-11-23T10:22:00"),
  method: "DRAWN" as const,
  sourceSha256: "a".repeat(64),
  documentTitle: "Purchase contract",
  matterReference: "HV-2026-0142",
  signerIp: "192.0.2.24",
  signerUserAgent: "Mozilla/5.0",
};

describe("stamping a signature onto a document", () => {
  it("appends one certificate page and keeps the original pages", async () => {
    const source = await sourcePdf(2);

    const signed = await stampSignature({
      sourcePdf: source,
      signatureImage: PNG,
      ...signer,
    });

    const result = await PDFDocument.load(signed);
    expect(result.getPageCount()).toBe(3);
  });

  it("produces a valid pdf", async () => {
    const signed = await stampSignature({
      sourcePdf: await sourcePdf(),
      signatureImage: PNG,
      ...signer,
    });

    expect(Buffer.from(signed.subarray(0, 5)).toString()).toBe("%PDF-");
  });

  // The version that was signed has to stay exactly as it was, because the
  // signature record and its hash both point at it.
  it("does not touch the source bytes", async () => {
    const source = await sourcePdf();
    const before = Uint8Array.from(source);

    await stampSignature({
      sourcePdf: source,
      signatureImage: PNG,
      ...signer,
    });

    expect(source).toEqual(before);
  });

  it("works for a typed signature too", async () => {
    const signed = await stampSignature({
      sourcePdf: await sourcePdf(),
      signatureImage: PNG,
      ...signer,
      method: "TYPED",
      signerIp: null,
      signerUserAgent: null,
    });

    const result = await PDFDocument.load(signed);
    expect(result.getPageCount()).toBe(2);
  });
});
