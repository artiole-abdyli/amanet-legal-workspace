"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { SignatureStatus } from "@/app/generated/prisma/client";
import { assertMatterWritable, requireAdminActor } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { documentTitle, firstName, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { LIMITS, isEmail } from "@/lib/validation";
import { createSecureToken, hashSecureToken, signUrl } from "@/lib/secure-link";

/** The states in which a request is still out with the signer. */
const LIVE: SignatureStatus[] = ["SENT", "VIEWED", "STARTED"];

const ALLOWED_DAYS = new Set([7, 14, 30]);

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
  const { actor } = await requireAdminActor();
  await assertMatterWritable(matterId);

  const documentId = String(formData.get("documentId") ?? "");
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signerEmail = String(formData.get("signerEmail") ?? "").trim();
  const requestedDays = Number(formData.get("days") ?? 14);
  const days = ALLOWED_DAYS.has(requestedDays) ? requestedDays : 14;
  const message = String(formData.get("message") ?? "").trim();

  const back = `/matters/${matterId}/request-signature${
    documentId ? `?document=${encodeURIComponent(documentId)}&` : "?"
  }error=`;

  if (!documentId) redirect(`${back}document`);
  if (!signerName || signerName.length > LIMITS.name) redirect(`${back}name`);
  if (!isEmail(signerEmail)) redirect(`${back}email`);
  if (message.length > LIMITS.message) redirect(`${back}message`);

  const version = await prisma.documentVersion.findFirst({
    where: { documentId, document: { matterId, folder: "CONTRACTS", archivedAt: null } },
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
  if (!version) redirect(`${back}document`);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const token = createSecureToken();
  const title = documentTitle(version.document.name);

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.signatureRequest.create({
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
    await tx.activityEvent.create({
      data: {
        matterId,
        type: "SIGNATURE",
        summary: `Signature request sent to ${signerName} for ${title} v${version.versionNo}`,
        ...actor,
      },
    });
    return created;
  });

  await sendEmail({
    firmId: version.document.matter.firmId,
    to: signerEmail,
    subject: `Please sign: ${title}`,
    body: [
      `Hello ${firstName(signerName)},`,
      "",
      message ||
        `${actor.actorName} at Abdyli & Partners has asked you to sign a document for ${version.document.matter.title}.`,
      "",
      signUrl(token),
      "",
      `This link was made for you alone and stops working on ${formatDate(expiresAt)}.`,
      "",
      "Abdyli & Partners",
    ].join("\n"),
  });

  revalidatePath(`/matters/${matterId}`);
  redirect(`/matters/${matterId}?tab=signatures&sent=${request.id}`);
}

/**
 * Revoking is the firm's stop button.
 *
 * Only a request still out with the signer can be revoked: the status is part
 * of the WHERE clause, so a request that was signed a moment ago stays signed.
 * Every live link is revoked in the same transaction, so a link already sitting
 * in the signer's inbox stops working immediately.
 */
export async function revokeSignature(id: string, formData: FormData) {
  const { actor } = await requireAdminActor();
  const reason = String(formData.get("reason") ?? "")
    .trim()
    .slice(0, LIMITS.reason);
  const signature = await loadSignature(id);
  await assertMatterWritable(signature.matter.id);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.signatureRequest.updateMany({
      where: { id, status: { in: LIVE } },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokedReason: reason || "No reason given",
      },
    });
    if (count !== 1) {
      throw new Error("Only a request still waiting for a signature can be revoked.");
    }
    await tx.secureLink.updateMany({
      where: { signatureRequestId: id, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.activityEvent.create({
      data: {
        matterId: signature.matter.id,
        type: "SIGNATURE",
        summary: `Signing link for ${signature.signerName} revoked: ${
          reason || "no reason given"
        }`,
        ...actor,
      },
    });
  });

  revalidatePath(`/matters/${signature.matter.id}`);
}

/**
 * Sends the signer a new link. The old one is revoked, because the stored hash
 * cannot be turned back into a usable URL.
 *
 * Refused unless the request is still live and unexpired, so a signed, revoked
 * or expired request never produces an email with a link that leads nowhere.
 */
export async function resendSigningLink(id: string) {
  const { actor } = await requireAdminActor();
  const signature = await loadSignature(id);
  await assertMatterWritable(signature.matter.id);

  const token = createSecureToken();
  const title = documentTitle(signature.documentVersion.document.name);

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.signatureRequest.updateMany({
      where: { id, status: { in: LIVE }, expiresAt: { gt: new Date() } },
      data: { updatedAt: new Date() },
    });
    if (count !== 1) {
      throw new Error("This request is no longer waiting for a signature.");
    }
    await tx.secureLink.updateMany({
      where: { signatureRequestId: id, revokedAt: null, usedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.secureLink.create({
      data: {
        purpose: "SIGN",
        tokenHash: hashSecureToken(token),
        signatureRequestId: id,
        expiresAt: signature.expiresAt,
      },
    });
    await tx.activityEvent.create({
      data: {
        matterId: signature.matter.id,
        type: "SIGNATURE",
        summary: `Reminder sent to ${signature.signerName}`,
        ...actor,
      },
    });
  });

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
      "Abdyli & Partners",
    ].join("\n"),
  });

  revalidatePath(`/matters/${signature.matter.id}`);
}
