import { connection } from "next/server";

import { prisma } from "@/lib/prisma";
import { SIGNED_COPY_DAYS, hashSecureToken } from "@/lib/secure-link";

/**
 * The one place a secure link is turned into permission to do something.
 *
 * Every client-facing route goes through this. The token is hashed and looked
 * up; purpose, expiry, revocation and single use are all re-checked here on the
 * server, so a link that was valid when it was emailed is still only as good as
 * its current row.
 */

export type LinkFailure = "not-found" | "wrong-purpose" | "expired" | "revoked" | "used";

export type LinkResult<T> =
  | { ok: true; linkId: string; target: T }
  | { ok: false; reason: LinkFailure };

const signInclude = {
  signatureRequest: {
    include: {
      matter: {
        select: {
          id: true,
          firmId: true,
          reference: true,
          title: true,
          client: { select: { name: true } },
        },
      },
      documentVersion: {
        include: { document: { select: { id: true, name: true } } },
      },
    },
  },
} as const;

const uploadInclude = {
  documentRequest: {
    include: {
      matter: {
        select: {
          id: true,
          firmId: true,
          reference: true,
          title: true,
          client: { select: { name: true, contactName: true } },
        },
      },
      submittedDocument: { select: { id: true, name: true } },
    },
  },
} as const;

function checkLink(link: {
  purpose: string;
  expiresAt: Date;
  revokedAt: Date | null;
  usedAt: Date | null;
}, purpose: "SIGN" | "UPLOAD"): LinkFailure | null {
  if (link.purpose !== purpose) return "wrong-purpose";
  if (link.revokedAt) return "revoked";
  if (link.usedAt) return "used";
  if (link.expiresAt.getTime() <= Date.now()) return "expired";
  return null;
}

export async function openSigningLink(token: string) {
  await connection();
  const link = await prisma.secureLink.findUnique({
    where: { tokenHash: hashSecureToken(token) },
    include: signInclude,
  });

  if (!link || !link.signatureRequest) return { ok: false as const, reason: "not-found" as const };

  const failure = checkLink(link, "SIGN");
  if (failure) return { ok: false as const, reason: failure };

  return {
    ok: true as const,
    linkId: link.id,
    expiresAt: link.expiresAt,
    target: link.signatureRequest,
  };
}

export async function openUploadLink(token: string) {
  await connection();
  const link = await prisma.secureLink.findUnique({
    where: { tokenHash: hashSecureToken(token) },
    include: uploadInclude,
  });

  if (!link || !link.documentRequest) return { ok: false as const, reason: "not-found" as const };

  const failure = checkLink(link, "UPLOAD");
  if (failure) return { ok: false as const, reason: failure };

  return {
    ok: true as const,
    linkId: link.id,
    expiresAt: link.expiresAt,
    target: link.documentRequest,
  };
}

/** Records that the link was opened, which is useful when chasing a client. */
export async function touchLink(linkId: string) {
  await connection();
  await prisma.secureLink.update({
    where: { id: linkId },
    data: { lastSeenAt: new Date() },
  });
}

/**
 * Reads a signing link that has already been spent.
 *
 * Signing redirects to a confirmation page, and by then the link is used, so
 * the ordinary check would refuse it. This grants nothing: it only answers
 * "was this link used to sign, and what was signed", and the caller refuses
 * anything that is not already SIGNED.
 */
export async function openCompletedSigningLink(token: string) {
  await connection();

  const link = await prisma.secureLink.findUnique({
    where: { tokenHash: hashSecureToken(token) },
    include: signInclude,
  });

  if (!link?.signatureRequest) return null;
  if (link.purpose !== "SIGN") return null;
  if (link.signatureRequest.status !== "SIGNED") return null;

  return link.signatureRequest;
}

/**
 * The signed PDF for a spent signing link, while the download window is open.
 *
 * Like `openCompletedSigningLink` it grants nothing but a read, and only of
 * the one document the link produced. A revoked link (the firm pressed stop
 * after the fact) or one past the window gets nothing.
 */
export async function openSignedCopy(token: string) {
  await connection();

  const link = await prisma.secureLink.findUnique({
    where: { tokenHash: hashSecureToken(token) },
    select: {
      purpose: true,
      revokedAt: true,
      signatureRequest: {
        select: {
          status: true,
          signedAt: true,
          signedDocument: {
            select: {
              name: true,
              versions: {
                orderBy: { versionNo: "desc" },
                take: 1,
                select: { storageKey: true, mimeType: true },
              },
            },
          },
        },
      },
    },
  });

  const signature = link?.signatureRequest;
  if (!link || link.purpose !== "SIGN" || link.revokedAt) return null;
  if (!signature || signature.status !== "SIGNED" || !signature.signedAt) return null;

  const closesAt = signature.signedAt.getTime() + SIGNED_COPY_DAYS * 86_400_000;
  if (Date.now() > closesAt) return null;

  const version = signature.signedDocument?.versions[0];
  if (!version || !signature.signedDocument) return null;

  return { name: signature.signedDocument.name, ...version };
}
