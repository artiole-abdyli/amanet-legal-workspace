import { connection } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashSecureToken } from "@/lib/secure-link";

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
