import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Produces the signed PDF.
 *
 * The signature is drawn onto the last page of the document that was actually
 * sent, and a certificate of completion is appended recording who signed, when,
 * from where, and the SHA-256 of the source file. The result is a new file; the
 * version that was signed is never modified.
 */

const MARGIN = 56;
const INK = rgb(0.07, 0.13, 0.1);
const GREY = rgb(0.42, 0.46, 0.44);
const RULE = rgb(0.84, 0.86, 0.85);

export type SignatureStamp = {
  sourcePdf: Uint8Array;
  /** PNG bytes of the drawn or rendered signature. */
  signatureImage: Uint8Array;
  signerName: string;
  signerEmail: string;
  signedAt: Date;
  method: "DRAWN" | "TYPED";
  sourceSha256: string;
  documentTitle: string;
  matterReference: string;
  signerIp: string | null;
  signerUserAgent: string | null;
};

function formatDateTime(date: Date) {
  return `${date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  })}, ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  })}`;
}

type Measurable = { widthOfTextAtSize(text: string, size: number): number };

function wrap(
  text: string,
  font: Measurable,
  size: number,
  maxWidth: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function stampSignature(
  input: SignatureStamp,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input.sourcePdf);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const image = await pdf.embedPng(input.signatureImage);

  const pages = pdf.getPages();
  const last = pages[pages.length - 1];
  const { width } = last.getSize();

  // Sit the signature above the lower-left signing line, scaled to fit.
  const maxWidth = Math.min(220, width / 2 - MARGIN);
  const scale = Math.min(maxWidth / image.width, 56 / image.height);
  last.drawImage(image, {
    x: MARGIN + 4,
    y: MARGIN + 52,
    width: image.width * scale,
    height: image.height * scale,
  });

  last.drawText(
    `Signed by ${input.signerName} · ${formatDateTime(input.signedAt)}`,
    { x: MARGIN, y: MARGIN + 36, size: 8, font: sans, color: GREY },
  );

  // Certificate page
  const cert = pdf.addPage([595.28, 841.89]);
  const inner = 595.28 - MARGIN * 2;
  let y = 841.89 - MARGIN;

  cert.drawText("CERTIFICATE OF COMPLETION", {
    x: MARGIN,
    y,
    size: 8,
    font: sansBold,
    color: GREY,
  });
  y -= 10;
  cert.drawLine({
    start: { x: MARGIN, y },
    end: { x: 595.28 - MARGIN, y },
    thickness: 0.5,
    color: RULE,
  });
  y -= 34;

  cert.drawText("Electronically signed", {
    x: MARGIN,
    y,
    size: 16,
    font: serifBold,
    color: INK,
  });
  y -= 34;

  const rows: [string, string][] = [
    ["Document", input.documentTitle],
    ["Matter reference", input.matterReference],
    ["Signer", input.signerName],
    ["Signer email", input.signerEmail],
    ["Signed at", `${formatDateTime(input.signedAt)} (Europe/London)`],
    ["Signature method", input.method === "DRAWN" ? "Drawn" : "Typed"],
    ["Signer IP address", input.signerIp ?? "Not recorded"],
    ["Signer device", input.signerUserAgent ?? "Not recorded"],
    ["SHA-256 of signed source", input.sourceSha256],
  ];

  for (const [label, value] of rows) {
    cert.drawText(label, { x: MARGIN, y, size: 9, font: sans, color: GREY });
    const lines = wrap(value, serif, 10, inner - 170);
    lines.forEach((line, index) => {
      cert.drawText(line, {
        x: MARGIN + 170,
        y: y - index * 13,
        size: 10,
        font: serif,
        color: INK,
      });
    });
    y -= Math.max(13 * lines.length, 13) + 9;
    cert.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: 595.28 - MARGIN, y: y + 6 },
      thickness: 0.5,
      color: RULE,
    });
    y -= 9;
  }

  y -= 10;
  for (const line of wrap(
    "This certificate records how the document above was signed electronically. It is produced by the Harlow & Vance matter workspace and is not a qualified electronic signature under eIDAS.",
    sans,
    8.5,
    inner,
  )) {
    cert.drawText(line, { x: MARGIN, y, size: 8.5, font: sans, color: GREY });
    y -= 12;
  }

  return pdf.save();
}
