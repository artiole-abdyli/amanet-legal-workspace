"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendEmail } from "@/lib/email";
import { firstName, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  createSecureToken,
  hashSecureToken,
  uploadUrl,
} from "@/lib/secure-link";

const ACTOR = { actorType: "ADMIN" as const, actorName: "Elena Vance" };

const LINK_DAYS = 14;

function expiry(days = LINK_DAYS) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function loadRequest(requestId: string) {
  return prisma.documentRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      matter: {
        select: {
          id: true,
          firmId: true,
          title: true,
          client: { select: { name: true, contactName: true, email: true } },
        },
      },
    },
  });
}

type LoadedRequest = Awaited<ReturnType<typeof loadRequest>>;

/**
 * Issues a fresh upload link and emails it.
 *
 * Any link still live for this request is revoked first, so only one is usable
 * at a time. Because only the hash of a token is stored, an old link can never
 * be recovered and re-sent: re-issuing is the only way, which is exactly the
 * property that makes a leaked database useless.
 */
async function issueUploadLink(
  request: LoadedRequest,
  subject: string,
  intro: string,
) {
  const token = createSecureToken();
  const expiresAt = expiry();
  const recipient =
    request.matter.client.contactName ?? request.matter.client.name;

  await prisma.$transaction([
    prisma.secureLink.updateMany({
      where: { documentRequestId: request.id, revokedAt: null, usedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.secureLink.create({
      data: {
        purpose: "UPLOAD",
        tokenHash: hashSecureToken(token),
        documentRequestId: request.id,
        expiresAt,
      },
    }),
  ]);

  await sendEmail({
    firmId: request.matter.firmId,
    to: request.matter.client.email,
    subject,
    body: [
      `Hello ${firstName(recipient)},`,
      "",
      intro,
      "",
      uploadUrl(token),
      "",
      `This link was made for you alone and stops working on ${formatDate(expiresAt)}.`,
      "",
      "Harlow & Vance LLP",
    ].join("\n"),
  });
}

export async function createDocumentRequest(
  matterId: string,
  formData: FormData,
) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const description =
    String(formData.get("description") ?? "").trim() ||
    "Please upload this document as a PDF.";
  const rawDue = String(formData.get("dueDate") ?? "");

  const created = await prisma.documentRequest.create({
    data: {
      matterId,
      title,
      description,
      dueDate: rawDue ? new Date(`${rawDue}T12:00:00`) : null,
    },
  });

  const request = await loadRequest(created.id);

  await issueUploadLink(
    request,
    `We need a document: ${title}`,
    `${description}\n\nYou can upload it here:`,
  );

  await prisma.activityEvent.create({
    data: {
      matterId,
      type: "REQUEST",
      summary: `Requested ${title} from ${
        request.matter.client.contactName ?? request.matter.client.name
      }`,
      ...ACTOR,
    },
  });

  revalidatePath(`/matters/${matterId}`);
  redirect(`/matters/${matterId}?tab=requests`);
}

export async function acceptDocumentRequest(requestId: string) {
  const request = await prisma.documentRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTED", resolvedAt: new Date(), reviewNote: null },
  });

  await prisma.activityEvent.create({
    data: {
      matterId: request.matterId,
      type: "REQUEST",
      summary: `Accepted ${request.title}`,
      ...ACTOR,
    },
  });

  revalidatePath(`/matters/${request.matterId}`);
}

export async function requestChanges(requestId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;

  const request = await loadRequest(requestId);

  await prisma.documentRequest.update({
    where: { id: requestId },
    data: { status: "CHANGES_REQUESTED", reviewNote: note },
  });

  await issueUploadLink(
    request,
    `A new copy is needed: ${request.title}`,
    `We have looked at what you sent for "${request.title}" and need a new copy.\n\n${note}\n\nYou can upload it here:`,
  );

  await prisma.activityEvent.create({
    data: {
      matterId: request.matter.id,
      type: "REQUEST",
      summary: `Asked for a new copy of ${request.title}`,
      ...ACTOR,
    },
  });

  revalidatePath(`/matters/${request.matter.id}`);
}

export async function resendUploadLink(requestId: string) {
  const request = await loadRequest(requestId);

  await issueUploadLink(
    request,
    `A reminder about ${request.title}`,
    `This is a reminder that we still need "${request.title}" for your matter, ${request.matter.title}. You can upload it here:`,
  );

  await prisma.activityEvent.create({
    data: {
      matterId: request.matter.id,
      type: "REQUEST",
      summary: `Reminder sent for ${request.title}`,
      ...ACTOR,
    },
  });

  revalidatePath(`/matters/${request.matter.id}`);
}
