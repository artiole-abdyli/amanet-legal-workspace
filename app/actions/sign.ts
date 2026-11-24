"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendEmail } from "@/lib/email";
import { documentTitle, firstName } from "@/lib/format";
import { openSigningLink } from "@/lib/link-access";
import { stampSignature } from "@/lib/pdf/sign";
import { prisma } from "@/lib/prisma";
import { rateLimit, waitMessage } from "@/lib/rate-limit";
import { decodeSignaturePng } from "@/lib/signature-image";
import { SIGNED_COPY_DAYS, signedCopyUrl } from "@/lib/secure-link";
import { deleteObject, documentKey, getObject, putObject } from "@/lib/storage";

/**
 * The signing flow, driven entirely from the token.
 *
 * Nothing here trusts an id sent by the browser: the link is re-opened and
 * re-checked on every call, so a client who has a stale page, a revoked link or
 * an expired one cannot push a signature through.
 */

/**
 * Only the refusals come back. A successful signature redirects, so the page
 * that renders afterwards is a plain GET: refreshing it cannot sign twice, and
 * the confirmation does not depend on client state surviving a re-render.
 */
export type SignOutcome = { ok: false; message: string };

/** Another submission spent the link or closed the request first. */
class LostRace extends Error {}

/** Sent -> Viewed, on the first open of the page. */
export async function markViewed(token: string) {
  const result = await openSigningLink(token);
  if (!result.ok) return;

  const signature = result.target;
  if (signature.status !== "SENT") return;

  const title = documentTitle(signature.documentVersion.document.name);

  await prisma.$transaction(async (tx) => {
    // Conditional on the status, so two tabs opening at once record one view.
    const { count } = await tx.signatureRequest.updateMany({
      where: { id: signature.id, status: "SENT" },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    if (count !== 1) return;

    await tx.secureLink.update({
      where: { id: result.linkId },
      data: { lastSeenAt: new Date() },
    });
    await tx.activityEvent.create({
      data: {
        matterId: signature.matter.id,
        type: "SIGNATURE",
        summary: `${signature.signerName} opened ${title} v${signature.documentVersion.versionNo}`,
        actorType: "CLIENT",
        actorName: signature.signerName,
      },
    });
    await tx.notification.create({
      data: {
        firmId: signature.matter.firmId,
        matterId: signature.matter.id,
        text: `${signature.signerName} opened ${title}`,
        href: `/matters/${signature.matter.id}?tab=signatures`,
      },
    });
  });

  revalidatePath(`/matters/${signature.matter.id}`);
}

/** Viewed -> Started, when the signer first puts pen to the pad. */
export async function markStarted(token: string) {
  const result = await openSigningLink(token);
  if (!result.ok) return;

  const signature = result.target;
  if (signature.status !== "SENT" && signature.status !== "VIEWED") return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.signatureRequest.updateMany({
      where: { id: signature.id, status: { in: ["SENT", "VIEWED"] } },
      data: {
        status: "STARTED",
        startedAt: now,
        viewedAt: signature.viewedAt ?? now,
      },
    });
    if (count !== 1) return;

    await tx.activityEvent.create({
      data: {
        matterId: signature.matter.id,
        type: "SIGNATURE",
        summary: `${signature.signerName} started signing`,
        actorType: "CLIENT",
        actorName: signature.signerName,
      },
    });
  });

  revalidatePath(`/matters/${signature.matter.id}`);
}

export async function submitSignature(
  token: string,
  formData: FormData,
): Promise<SignOutcome> {
  const limit = rateLimit(`sign:${token}`, 10, 10 * 60_000);
  if (!limit.ok) {
    return {
      ok: false,
      message: `Too many attempts from this link. ${waitMessage(limit.retryAfter)}`,
    };
  }

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

  const image = decodeSignaturePng(String(formData.get("signature") ?? ""));
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

  // The id is chosen here rather than by the database, so the bytes can be
  // written before any row exists. A failed write then leaves nothing behind,
  // instead of a document with no versions that breaks the Documents tab.
  const signedDocumentId = randomUUID();

  const stored = await putObject(
    documentKey(matter.id, signedDocumentId, 1),
    signedPdf,
  );

  // Spending the link and closing the request are both conditional, inside one
  // transaction. Two submissions racing from a double click or two tabs both
  // pass the check above, but only one can flip `usedAt` from null; the other
  // finds nothing to update, rolls back, and gets a clear answer instead of
  // a second signed PDF.
  let won = false;
  try {
    await prisma.$transaction(async (tx) => {
      const spent = await tx.secureLink.updateMany({
        where: { id: result.linkId, usedAt: null, revokedAt: null },
        data: { usedAt: signedAt },
      });
      if (spent.count !== 1) throw new LostRace();

      await tx.document.create({
        data: {
          id: signedDocumentId,
          matterId: matter.id,
          folder: "SIGNED",
          name: `${title} — signed.pdf`,
        },
      });
      await tx.documentVersion.create({
        data: {
          documentId: signedDocumentId,
          versionNo: 1,
          storageKey: stored.key,
          sha256: stored.sha256,
          byteSize: stored.byteSize,
          uploadedByType: "CLIENT",
          uploadedByName: `${signature.signerName} (e-signed)`,
        },
      });

      const closed = await tx.signatureRequest.updateMany({
        where: {
          id: signature.id,
          status: { in: ["SENT", "VIEWED", "STARTED"] },
          expiresAt: { gt: signedAt },
        },
        data: {
          status: "SIGNED",
          signedAt,
          viewedAt: signature.viewedAt ?? signedAt,
          startedAt: signature.startedAt ?? signedAt,
          signatureMethod: method,
          signerIp,
          signerUserAgent,
          signedDocumentId,
          signedSha256: stored.sha256,
        },
      });
      if (closed.count !== 1) throw new LostRace();

      await tx.activityEvent.createMany({
        data: [
          {
            matterId: matter.id,
            type: "SIGNATURE",
            summary: `${signature.signerName} signed ${title} v${version.versionNo}`,
            actorType: "CLIENT",
            actorName: signature.signerName,
          },
          {
            matterId: matter.id,
            type: "DOCUMENT",
            summary: "Signed PDF and certificate saved to the Signed folder",
            actorType: "SYSTEM",
            actorName: "Workspace",
          },
        ],
      });
      await tx.notification.create({
        data: {
          firmId: matter.firmId,
          matterId: matter.id,
          text: `${signature.signerName} signed ${title}`,
          href: `/matters/${matter.id}?tab=signatures`,
        },
      });
    });
    won = true;
  } catch (error) {
    if (!(error instanceof LostRace)) throw error;
    return {
      ok: false,
      message:
        "This document was already signed or the request was closed. Refresh the page to see its current state.",
    };
  } finally {
    // The bytes were written before the rows; if the rows did not land, the
    // file belongs to nothing and is removed.
    if (!won) await deleteObject(stored.key).catch(() => {});
  }

  await sendEmail({
    firmId: matter.firmId,
    to: signature.signerEmail,
    subject: `Your signed copy: ${title}`,
    body: [
      `Hello ${firstName(signature.signerName)},`,
      "",
      `Thank you for signing ${title}. Your signed copy, with its certificate of completion, has been filed with your matter, ${matter.title}.`,
      "",
      `You can download it here for the next ${SIGNED_COPY_DAYS} days:`,
      "",
      signedCopyUrl(token),
      "",
      "Harlow & Vance LLP",
    ].join("\n"),
  });

  revalidatePath(`/matters/${matter.id}`);
  redirect(`/sign/${token}/done`);
}
