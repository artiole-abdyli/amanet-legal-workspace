"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { sendEmail } from "@/lib/email";
import { documentTitle } from "@/lib/format";
import { openSigningLink } from "@/lib/link-access";
import { stampSignature } from "@/lib/pdf/sign";
import { prisma } from "@/lib/prisma";
import { documentKey, getObject, putObject } from "@/lib/storage";

/**
 * The signing flow, driven entirely from the token.
 *
 * Nothing here trusts an id sent by the browser: the link is re-opened and
 * re-checked on every call, so a client who has a stale page, a revoked link or
 * an expired one cannot push a signature through.
 */

export type SignOutcome =
  | { ok: true }
  | { ok: false; message: string };

/** Sent -> Viewed, on the first open of the page. */
export async function markViewed(token: string) {
  const result = await openSigningLink(token);
  if (!result.ok) return;

  const signature = result.target;
  if (signature.status !== "SENT") return;

  await prisma.$transaction([
    prisma.signatureRequest.update({
      where: { id: signature.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    }),
    prisma.secureLink.update({
      where: { id: result.linkId },
      data: { lastSeenAt: new Date() },
    }),
    prisma.activityEvent.create({
      data: {
        matterId: signature.matter.id,
        type: "SIGNATURE",
        summary: `${signature.signerName} opened ${documentTitle(
          signature.documentVersion.document.name,
        )} v${signature.documentVersion.versionNo}`,
        actorType: "CLIENT",
        actorName: signature.signerName,
      },
    }),
    prisma.notification.create({
      data: {
        firmId: signature.matter.firmId,
        matterId: signature.matter.id,
        text: `${signature.signerName} opened ${documentTitle(
          signature.documentVersion.document.name,
        )}`,
        href: `/matters/${signature.matter.id}?tab=signatures`,
      },
    }),
  ]);

  revalidatePath(`/matters/${signature.matter.id}`);
}

/** Viewed -> Started, when the signer first puts pen to the pad. */
export async function markStarted(token: string) {
  const result = await openSigningLink(token);
  if (!result.ok) return;

  const signature = result.target;
  if (signature.status !== "SENT" && signature.status !== "VIEWED") return;

  const now = new Date();
  await prisma.$transaction([
    prisma.signatureRequest.update({
      where: { id: signature.id },
      data: {
        status: "STARTED",
        startedAt: now,
        viewedAt: signature.viewedAt ?? now,
      },
    }),
    prisma.activityEvent.create({
      data: {
        matterId: signature.matter.id,
        type: "SIGNATURE",
        summary: `${signature.signerName} started signing`,
        actorType: "CLIENT",
        actorName: signature.signerName,
      },
    }),
  ]);

  revalidatePath(`/matters/${signature.matter.id}`);
}

function decodePng(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[1], "base64");
  // A PNG always starts with this signature; anything else is not an image.
  const magic = [0x89, 0x50, 0x4e, 0x47];
  if (bytes.length < 8 || magic.some((byte, i) => bytes[i] !== byte)) return null;
  if (bytes.byteLength > 2_000_000) return null;
  return new Uint8Array(bytes);
}

export async function submitSignature(
  token: string,
  formData: FormData,
): Promise<SignOutcome> {
  const result = await openSigningLink(token);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "revoked"
          ? "This signing link was cancelled by the firm."
          : result.reason === "expired"
            ? "This signing link has expired."
            : "This signing link is no longer valid.",
    };
  }

  const signature = result.target;

  if (signature.status === "SIGNED") {
    return { ok: false, message: "This document has already been signed." };
  }
  if (signature.status === "REVOKED" || signature.status === "EXPIRED") {
    return { ok: false, message: "This signing request is closed." };
  }

  if (formData.get("consent") !== "on") {
    return {
      ok: false,
      message: "Please confirm that you agree to sign electronically.",
    };
  }

  const image = decodePng(String(formData.get("signature") ?? ""));
  if (!image) {
    return { ok: false, message: "Your signature did not come through. Please try again." };
  }

  const method = formData.get("method") === "TYPED" ? "TYPED" : "DRAWN";
  const version = signature.documentVersion;
  const matter = signature.matter;
  const title = documentTitle(version.document.name);
  const signedAt = new Date();

  const headerList = await headers();
  const signerIp =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const signerUserAgent = headerList.get("user-agent");

  const sourcePdf = await getObject(version.storageKey);

  const signedPdf = await stampSignature({
    sourcePdf: new Uint8Array(sourcePdf),
    signatureImage: image,
    signerName: signature.signerName,
    signerEmail: signature.signerEmail,
    signedAt,
    method,
    sourceSha256: version.sha256,
    documentTitle: title,
    matterReference: matter.reference,
    signerIp,
    signerUserAgent,
  });

  // Create the output document first so the stored object has a key to live at.
  const signedDocument = await prisma.document.create({
    data: {
      matterId: matter.id,
      folder: "SIGNED",
      name: `${title} — signed.pdf`,
    },
  });

  const stored = await putObject(
    documentKey(matter.id, signedDocument.id, 1),
    signedPdf,
  );

  await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        documentId: signedDocument.id,
        versionNo: 1,
        storageKey: stored.key,
        sha256: stored.sha256,
        byteSize: stored.byteSize,
        uploadedByType: "CLIENT",
        uploadedByName: `${signature.signerName} (e-signed)`,
      },
    }),
    prisma.signatureRequest.update({
      where: { id: signature.id },
      data: {
        status: "SIGNED",
        signedAt,
        viewedAt: signature.viewedAt ?? signedAt,
        startedAt: signature.startedAt ?? signedAt,
        signatureMethod: method,
        signerIp,
        signerUserAgent,
        signedDocumentId: signedDocument.id,
        signedSha256: stored.sha256,
      },
    }),
    // A signing link is single use: spending it closes it.
    prisma.secureLink.update({
      where: { id: result.linkId },
      data: { usedAt: signedAt },
    }),
    prisma.activityEvent.create({
      data: {
        matterId: matter.id,
        type: "SIGNATURE",
        summary: `${signature.signerName} signed ${title} v${version.versionNo}`,
        actorType: "CLIENT",
        actorName: signature.signerName,
      },
    }),
    prisma.activityEvent.create({
      data: {
        matterId: matter.id,
        type: "DOCUMENT",
        summary: "Signed PDF and certificate saved to the Signed folder",
        actorType: "SYSTEM",
        actorName: "Workspace",
      },
    }),
    prisma.notification.create({
      data: {
        firmId: matter.firmId,
        matterId: matter.id,
        text: `${signature.signerName} signed ${title}`,
        href: `/matters/${matter.id}?tab=signatures`,
      },
    }),
  ]);

  await sendEmail({
    firmId: matter.firmId,
    to: signature.signerEmail,
    subject: `Your signed copy: ${title}`,
    body: [
      `Hello ${signature.signerName},`,
      "",
      `Thank you for signing ${title}. A signed copy with its certificate of completion is attached to your matter, ${matter.title}.`,
      "",
      "Harlow & Vance LLP",
    ].join("\n"),
  });

  revalidatePath(`/matters/${matter.id}`);
  return { ok: true };
}
