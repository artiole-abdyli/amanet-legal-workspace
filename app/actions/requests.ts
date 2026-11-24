"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { DocumentRequestStatus } from "@/app/generated/prisma/client";
import { assertMatterWritable, requireAdminActor } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { firstName, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  createSecureToken,
  hashSecureToken,
  uploadUrl,
} from "@/lib/secure-link";

const LINK_DAYS = 14;

function expiry(days = LINK_DAYS) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

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

function recipientOf(request: LoadedRequest) {
  return request.matter.client.contactName ?? request.matter.client.name;
}

/**
 * Moves a request from one of the expected states to the next, or throws.
 *
 * The status is part of the WHERE clause, so two Admin tabs acting on the same
 * request cannot both win: the second finds nothing to update and is refused,
 * instead of, say, accepting a request whose file was never uploaded.
 */
async function transition(
  tx: Tx,
  requestId: string,
  from: DocumentRequestStatus[],
  data: Parameters<Tx["documentRequest"]["updateMany"]>[0]["data"],
) {
  const { count } = await tx.documentRequest.updateMany({
    where: { id: requestId, status: { in: from } },
    data,
  });
  if (count !== 1) {
    throw new Error("This request has changed since the page was loaded.");
  }
}

/**
 * Revokes any live link for the request and creates a new one, inside the
 * caller's transaction. Only one link is usable at a time, and because only
 * the hash of a token is stored, re-issuing is the only way to send a link
 * again — exactly the property that makes a leaked database useless.
 */
async function replaceUploadLink(tx: Tx, requestId: string) {
  const token = createSecureToken();
  const expiresAt = expiry();

  await tx.secureLink.updateMany({
    where: { documentRequestId: requestId, revokedAt: null, usedAt: null },
    data: { revokedAt: new Date() },
  });
  await tx.secureLink.create({
    data: {
      purpose: "UPLOAD",
      tokenHash: hashSecureToken(token),
      documentRequestId: requestId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * The email goes out after the transaction commits. Mail is not part of the
 * database and cannot be rolled back, so it is only sent once the state it
 * describes is certain; `sendEmail` records its own outcome in the outbox.
 */
async function emailUploadLink(
  request: LoadedRequest,
  link: { token: string; expiresAt: Date },
  subject: string,
  intro: string,
) {
  await sendEmail({
    firmId: request.matter.firmId,
    to: request.matter.client.email,
    subject,
    body: [
      `Hello ${firstName(recipientOf(request))},`,
      "",
      intro,
      "",
      uploadUrl(link.token),
      "",
      `This link was made for you alone and stops working on ${formatDate(link.expiresAt)}.`,
      "",
      "Harlow & Vance LLP",
    ].join("\n"),
  });
}

export async function createDocumentRequest(
  matterId: string,
  formData: FormData,
) {
  const { actor } = await requireAdminActor();
  await assertMatterWritable(matterId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    redirect(`/matters/${matterId}/request-documents?error=title`);
  }

  const description =
    String(formData.get("description") ?? "").trim() ||
    "Please upload this document as a PDF.";
  const rawDue = String(formData.get("dueDate") ?? "");

  const matter = await prisma.matter.findUniqueOrThrow({
    where: { id: matterId },
    select: { client: { select: { name: true, contactName: true } } },
  });
  const recipient = matter.client.contactName ?? matter.client.name;

  const { requestId, link } = await prisma.$transaction(async (tx) => {
    const created = await tx.documentRequest.create({
      data: {
        matterId,
        title,
        description,
        dueDate: rawDue ? new Date(`${rawDue}T12:00:00`) : null,
      },
    });
    const link = await replaceUploadLink(tx, created.id);
    await tx.activityEvent.create({
      data: {
        matterId,
        type: "REQUEST",
        summary: `Requested ${title} from ${recipient}`,
        ...actor,
      },
    });
    return { requestId: created.id, link };
  });

  await emailUploadLink(
    await loadRequest(requestId),
    link,
    `We need a document: ${title}`,
    `${description}\n\nYou can upload it here:`,
  );

  revalidatePath(`/matters/${matterId}`);
  redirect(`/matters/${matterId}?tab=requests`);
}

/** Only a submitted file can be accepted. */
export async function acceptDocumentRequest(requestId: string) {
  const { actor } = await requireAdminActor();
  const request = await loadRequest(requestId);
  await assertMatterWritable(request.matter.id);

  await prisma.$transaction(async (tx) => {
    await transition(tx, requestId, ["SUBMITTED"], {
      status: "ACCEPTED",
      resolvedAt: new Date(),
      reviewNote: null,
    });
    // Nothing more will be uploaded, so the link is closed with the request.
    await tx.secureLink.updateMany({
      where: { documentRequestId: requestId, revokedAt: null, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.activityEvent.create({
      data: {
        matterId: request.matter.id,
        type: "REQUEST",
        summary: `Accepted ${request.title}`,
        ...actor,
      },
    });
  });

  revalidatePath(`/matters/${request.matter.id}`);
}

/** Only a submitted file can be sent back for a new copy. */
export async function requestChanges(requestId: string, formData: FormData) {
  const { actor } = await requireAdminActor();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;

  const request = await loadRequest(requestId);
  await assertMatterWritable(request.matter.id);

  const link = await prisma.$transaction(async (tx) => {
    await transition(tx, requestId, ["SUBMITTED"], {
      status: "CHANGES_REQUESTED",
      reviewNote: note,
    });
    const link = await replaceUploadLink(tx, requestId);
    await tx.activityEvent.create({
      data: {
        matterId: request.matter.id,
        type: "REQUEST",
        summary: `Asked for a new copy of ${request.title}`,
        ...actor,
      },
    });
    return link;
  });

  await emailUploadLink(
    request,
    link,
    `A new copy is needed: ${request.title}`,
    `We have looked at what you sent for "${request.title}" and need a new copy.\n\n${note}\n\nYou can upload it here:`,
  );

  revalidatePath(`/matters/${request.matter.id}`);
}

/** A reminder only makes sense while the firm is still waiting on the client. */
export async function resendUploadLink(requestId: string) {
  const { actor } = await requireAdminActor();
  const request = await loadRequest(requestId);
  await assertMatterWritable(request.matter.id);

  const link = await prisma.$transaction(async (tx) => {
    // A no-op update that still checks the status under the transaction.
    await transition(tx, requestId, ["PENDING", "CHANGES_REQUESTED"], {
      updatedAt: new Date(),
    });
    const link = await replaceUploadLink(tx, requestId);
    await tx.activityEvent.create({
      data: {
        matterId: request.matter.id,
        type: "REQUEST",
        summary: `Reminder sent for ${request.title}`,
        ...actor,
      },
    });
    return link;
  });

  await emailUploadLink(
    request,
    link,
    `A reminder about ${request.title}`,
    `This is a reminder that we still need "${request.title}" for your matter, ${request.matter.title}. You can upload it here:`,
  );

  revalidatePath(`/matters/${request.matter.id}`);
}
