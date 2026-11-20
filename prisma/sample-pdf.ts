import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Builds the fictional PDFs the seed needs, so the demo has real files to
 * preview, download and sign rather than database rows pointing at nothing.
 */

const A4 = [595.28, 841.89] as const;
const MARGIN = 56;
const INK = rgb(0.07, 0.13, 0.1);
const GREY = rgb(0.42, 0.46, 0.44);
const RULE = rgb(0.84, 0.86, 0.85);

const CLAUSES: [string, string][] = [
  [
    "Parties",
    "This agreement is made between the parties named in Schedule 1 (each a \"Party\"). Each Party confirms that it has the authority to enter into this agreement and that the information it has provided is accurate.",
  ],
  [
    "Subject matter",
    "The Parties agree the terms set out below in relation to the matter referenced above. Schedule 2 forms part of this agreement and is to be read together with these clauses.",
  ],
  [
    "Price and payment",
    "Sums due under this agreement are payable within 14 days of the date of an invoice, by bank transfer to the account notified in writing by the receiving Party.",
  ],
  [
    "Completion",
    "Completion takes place on the date stated in Schedule 1, or on any other date the Parties agree in writing. Time is of the essence in respect of that date.",
  ],
  [
    "Governing law",
    "This agreement is governed by the law stated in Schedule 1, and the Parties submit to the exclusive jurisdiction of its courts in respect of any dispute arising under it.",
  ],
];

type Font = Awaited<ReturnType<PDFDocument["embedFont"]>>;

function wrap(text: string, font: Font, size: number, maxWidth: number) {
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

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${date
    .toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export type SamplePdfOptions = {
  title: string;
  reference: string;
  versionNo: number;
  /** A scanned client upload renders as a placeholder rather than clauses. */
  kind?: "contract" | "upload";
  signer?: {
    name: string;
    email: string;
    signedAt: Date;
    method: "DRAWN" | "TYPED";
    sourceSha256: string;
  };
};

export async function buildSamplePdf(
  options: SamplePdfOptions,
): Promise<Uint8Array> {
  const { title, reference, versionNo, kind = "contract", signer } = options;

  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setProducer("Harlow & Vance matter workspace");

  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const script = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = A4[0];
  const inner = width - MARGIN * 2;

  const page = pdf.addPage([A4[0], A4[1]]);
  let y = A4[1] - MARGIN;

  const header = (text: string, right: string) => {
    page.drawText(text, { x: MARGIN, y, size: 8, font: sansBold, color: GREY });
    const w = sans.widthOfTextAtSize(right, 8);
    page.drawText(right, {
      x: width - MARGIN - w,
      y,
      size: 8,
      font: sans,
      color: GREY,
    });
    y -= 10;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: width - MARGIN, y },
      thickness: 0.5,
      color: RULE,
    });
    y -= 28;
  };

  header("HARLOW & VANCE LLP", reference);

  page.drawText(title, { x: MARGIN, y, size: 19, font: serifBold, color: INK });
  y -= 18;
  page.drawText(`Version ${versionNo}`, {
    x: MARGIN,
    y,
    size: 9,
    font: sans,
    color: GREY,
  });
  y -= 30;

  if (kind === "upload") {
    const boxHeight = 320;
    page.drawRectangle({
      x: MARGIN,
      y: y - boxHeight,
      width: inner,
      height: boxHeight,
      color: rgb(0.95, 0.95, 0.94),
      borderColor: RULE,
      borderWidth: 0.5,
    });
    const label = "Scanned document supplied by the client";
    const w = sans.widthOfTextAtSize(label, 10);
    page.drawText(label, {
      x: MARGIN + (inner - w) / 2,
      y: y - boxHeight / 2,
      size: 10,
      font: sans,
      color: GREY,
    });
    y -= boxHeight + 24;
  } else {
    CLAUSES.forEach(([heading, text], index) => {
      page.drawText(`${index + 1}. ${heading.toUpperCase()}`, {
        x: MARGIN,
        y,
        size: 8.5,
        font: sansBold,
        color: GREY,
      });
      y -= 16;
      for (const line of wrap(text, serif, 10.5, inner)) {
        page.drawText(line, { x: MARGIN, y, size: 10.5, font: serif, color: INK });
        y -= 15;
      }
      y -= 12;
    });
  }

  // Signature block
  const slotWidth = (inner - 36) / 2;
  const slotY = Math.max(y - 40, MARGIN + 40);

  if (signer) {
    page.drawText(signer.name, {
      x: MARGIN + 4,
      y: slotY + 8,
      size: 20,
      font: script,
      color: rgb(0.11, 0.17, 0.31),
    });
  }

  page.drawLine({
    start: { x: MARGIN, y: slotY },
    end: { x: MARGIN + slotWidth, y: slotY },
    thickness: 0.5,
    color: rgb(0.6, 0.63, 0.61),
  });
  page.drawLine({
    start: { x: MARGIN + slotWidth + 36, y: slotY },
    end: { x: width - MARGIN, y: slotY },
    thickness: 0.5,
    color: rgb(0.6, 0.63, 0.61),
  });

  page.drawText(
    signer
      ? `Signed by ${signer.name} on ${formatDateTime(signer.signedAt)}`
      : "Signature of client",
    { x: MARGIN, y: slotY - 12, size: 8, font: sans, color: GREY },
  );
  page.drawText("For Harlow & Vance LLP", {
    x: MARGIN + slotWidth + 36,
    y: slotY - 12,
    size: 8,
    font: sans,
    color: GREY,
  });

  if (signer) {
    const cert = pdf.addPage([A4[0], A4[1]]);
    let cy = A4[1] - MARGIN;

    cert.drawText("CERTIFICATE OF COMPLETION", {
      x: MARGIN,
      y: cy,
      size: 8,
      font: sansBold,
      color: GREY,
    });
    cy -= 10;
    cert.drawLine({
      start: { x: MARGIN, y: cy },
      end: { x: width - MARGIN, y: cy },
      thickness: 0.5,
      color: RULE,
    });
    cy -= 34;

    cert.drawText("Electronically signed", {
      x: MARGIN,
      y: cy,
      size: 16,
      font: serifBold,
      color: INK,
    });
    cy -= 34;

    const rows: [string, string][] = [
      ["Document", title],
      ["Version", `${versionNo}`],
      ["Matter reference", reference],
      ["Signer", signer.name],
      ["Signer email", signer.email],
      ["Signed at", `${formatDateTime(signer.signedAt)} (UTC+01:00)`],
      ["Signature method", signer.method === "DRAWN" ? "Drawn" : "Typed"],
      ["SHA-256 of signed source", signer.sourceSha256],
    ];

    for (const [label, value] of rows) {
      cert.drawText(label, { x: MARGIN, y: cy, size: 9, font: sans, color: GREY });
      const valueLines = wrap(value, serif, 10, inner - 170);
      valueLines.forEach((line, i) => {
        cert.drawText(line, {
          x: MARGIN + 170,
          y: cy - i * 13,
          size: 10,
          font: serif,
          color: INK,
        });
      });
      cy -= Math.max(13 * valueLines.length, 13) + 9;
      cert.drawLine({
        start: { x: MARGIN, y: cy + 6 },
        end: { x: width - MARGIN, y: cy + 6 },
        thickness: 0.5,
        color: RULE,
      });
      cy -= 9;
    }

    cy -= 10;
    for (const line of wrap(
      "This certificate records how the document above was signed electronically. It is produced by the Harlow & Vance matter workspace and is not a qualified electronic signature under eIDAS.",
      sans,
      8.5,
      inner,
    )) {
      cert.drawText(line, { x: MARGIN, y: cy, size: 8.5, font: sans, color: GREY });
      cy -= 12;
    }
  }

  return pdf.save();
}
