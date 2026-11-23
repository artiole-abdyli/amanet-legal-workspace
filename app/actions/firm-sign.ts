"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { documentTitle } from "@/lib/format";
import { stampSignature } from "@/lib/pdf/sign";
import { prisma } from "@/lib/prisma";
import { decodeSignaturePng } from "@/lib/signature-image";
import { documentKey, getObject, putObject } from "@/lib/storage";

export type FirmSignState = { error: string } | null;

/**
 * The firm signing a document itself.
 *
 * It runs through the same machinery as a client signature, and records a
 * SignatureRequest in the SIGNED state, so the Signatures tab shows one
 * history whoever put pen to the page. The difference is only that there is no
 * secure link: the Admin is already authenticated.
 */
export async function signAsFirm(
  matterId: string,
  documentId: string,
  _previous: FirmSignState,
  formData: FormData,
): Promise<FirmSignState> {
  const user = await requireAdmin();

  if (formData.get("consent") !== "on") {
    return { error: "Confirm that you are authorised to sign for the firm." };
  }

  const image = decodeSignaturePng(String(formData.get("signature") ?? ""));
  if (!image) {
    return { error: "The signature did not come through. Please try again." };
  }

  const version = await prisma.documentVersion.findFirst({
    where: { documentId, document: { matterId } },
    orderBy: { versionNo: "desc" },
    include: {
      document: {
        select: {
          name: true,
          matter: { select: { id: true, firmId: true, reference: true } },
        },
      },
    },
  });

  if (!version) {
    return { error: "That document is no longer in this matter." };
  }

  const method = formData.get("method") === "TYPED" ? "TYPED" : "DRAWN";
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
    signerName: user.name,
    signerEmail: user.email,
    signedAt,
    method,
    sourceSha256: version.sha256,
    documentTitle: title,
    matterReference: version.document.matter.reference,
    signerIp,
    signerUserAgent,
  });

  const signedDocument = await prisma.document.create({
    data: {
      matterId,
      folder: "SIGNED",
      name: `${title} — signed by the firm.pdf`,
    },
  });

  const stored = await putObject(
    documentKey(matterId, signedDocument.id, 1),
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
        uploadedByType: "ADMIN",
        uploadedByName: `${user.name} (e-signed)`,
      },
    }),
    prisma.signatureRequest.create({
      data: {
        matterId,
        documentVersionId: version.id,
        signerName: user.name,
        signerEmail: user.email,
        status: "SIGNED",
        sentAt: signedAt,
        viewedAt: signedAt,
        startedAt: signedAt,
        signedAt,
        // Signed in person by the Admin, so the window is closed immediately.
        expiresAt: signedAt,
        signatureMethod: method,
        signerIp,
        signerUserAgent,
        signedDocumentId: signedDocument.id,
        signedSha256: stored.sha256,
      },
    }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "SIGNATURE",
        summary: `${user.name} signed ${title} v${version.versionNo} for the firm`,
        actorType: "ADMIN",
        actorName: user.name,
      },
    }),
  ]);

  revalidatePath(`/matters/${matterId}`);
  redirect(`/matters/${matterId}?tab=documents`);
}
