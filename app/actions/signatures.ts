"use server";

import { requireAdmin } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendEmail } from "@/lib/email";
import { documentTitle, firstName, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createSecureToken, hashSecureToken, signUrl } from "@/lib/secure-link";

const ACTOR = { actorType: "ADMIN" as const, actorName: "Elena Vance" };

async function loadSignature(id: string) {
  return prisma.signatureRequest.findUniqueOrThrow({
    where: { id },
    include: {
      matter: { select: { id: true, firmId: true, title: true } },
      documentVersion: {
        select: { versionNo: true, document: { select: { name: true } } },
      },
    },
  });
}

/**
 * Starts a signature request against one specific document version.
 *
 * The version is resolved here, on the server, at the moment the request is
 * created. Anything uploaded to that document afterwards becomes a new version
 * and leaves this request pointing where it always pointed.
 */
export async function createSignatureRequest(
  matterId: string,
  formData: FormData,
) {
  await requireAdmin();
  const documentId = String(formData.get("documentId") ?? "");
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signerEmail = String(formData.get("signerEmail") ?? "").trim();
  const days = Number(formData.get("days") ?? 14);
  const message = String(formData.get("message") ?? "").trim();

  if (!documentId || !signerName || !signerEmail) return;

  const version = await prisma.documentVersion.findFirstOrThrow({
    where: { documentId, document: { matterId } },
    orderBy: { versionNo: "desc" },
    include: {
      document: {
        select: {
          name: true,
          matter: { select: { id: true, firmId: true, title: true } },
        },
      },
    },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (Number.isFinite(days) ? days : 14));

  const token = createSecureToken();
  const title = documentTitle(version.document.name);

  const request = await prisma.signatureRequest.create({
    data: {
      matterId,
      documentVersionId: version.id,
      signerName,
      signerEmail,
      expiresAt,
      links: {
        create: {
          purpose: "SIGN",
          tokenHash: hashSecureToken(token),
          expiresAt,
        },
      },
    },
  });

  await prisma.activityEvent.create({
    data: {
      matterId,
      type: "SIGNATURE",
      summary: `Signature request sent to ${signerName} for ${title} v${version.versionNo}`,
      ...ACTOR,
    },
  });

  await sendEmail({
    firmId: version.document.matter.firmId,
    to: signerEmail,
    subject: `Please sign: ${title}`,
    body: [
      `Hello ${firstName(signerName)},`,
      "",
      message ||
        `${ACTOR.actorName} at Harlow & Vance has asked you to sign a document for ${version.document.matter.title}.`,
      "",
      signUrl(token),
      "",
      `This link was made for you alone and stops working on ${formatDate(expiresAt)}.`,
      "",
      "Harlow & Vance LLP",
    ].join("\n"),
  });

  revalidatePath(`/matters/${matterId}`);
  redirect(`/matters/${matterId}?tab=signatures&sent=${request.id}`);
}

/**
 * Revoking is the firm's stop button.
 *
 * The request moves to a terminal state and every live link for it is revoked
 * in the same transaction, so a link already sitting in the signer's inbox
 * stops working immediately.
 */
export async function revokeSignature(id: string, formData: FormData) {
  await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim();
  const signature = await loadSignature(id);
  const now = new Date();

  await prisma.$transaction([
    prisma.signatureRequest.update({
      where: { id },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokedReason: reason || "No reason given",
      },
    }),
    prisma.secureLink.updateMany({
      where: { signatureRequestId: id, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.activityEvent.create({
      data: {
        matterId: signature.matter.id,
        type: "SIGNATURE",
        summary: `Signing link for ${signature.signerName} revoked: ${
          reason || "no reason given"
        }`,
        ...ACTOR,
      },
    }),
  ]);

  revalidatePath(`/matters/${signature.matter.id}`);
}

/**
 * Sends the signer a new link. The old one is revoked, because the stored hash
 * cannot be turned back into a usable URL.
 */
export async function resendSigningLink(id: string) {
  await requireAdmin();
  const signature = await loadSignature(id);
  const token = createSecureToken();
  const title = documentTitle(signature.documentVersion.document.name);

  await prisma.$transaction([
    prisma.secureLink.updateMany({
      where: { signatureRequestId: id, revokedAt: null, usedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.secureLink.create({
      data: {
        purpose: "SIGN",
        tokenHash: hashSecureToken(token),
        signatureRequestId: id,
        expiresAt: signature.expiresAt,
      },
    }),
  ]);

  await sendEmail({
    firmId: signature.matter.firmId,
    to: signature.signerEmail,
    subject: `A reminder to sign: ${title}`,
    body: [
      `Hello ${firstName(signature.signerName)},`,
      "",
      `This is a reminder that ${title} is waiting for your signature.`,
      "",
      signUrl(token),
      "",
      `This link was made for you alone and stops working on ${formatDate(signature.expiresAt)}.`,
      "",
      "Harlow & Vance LLP",
    ].join("\n"),
  });

  await prisma.activityEvent.create({
    data: {
      matterId: signature.matter.id,
      type: "SIGNATURE",
      summary: `Reminder sent to ${signature.signerName}`,
      ...ACTOR,
    },
  });

  revalidatePath(`/matters/${signature.matter.id}`);
}
