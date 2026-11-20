import { getObject } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

/**
 * Serves a stored PDF.
 *
 * `?download=1` sends it as an attachment; otherwise it opens in the browser's
 * viewer, which is what the document preview uses.
 *
 * TODO: gate this on the Admin session once authentication is wired up. Client
 * access to documents goes through a secure link, never through this route.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: { select: { name: true } } },
  });

  if (!version) {
    return new Response("Document not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await getObject(version.storageKey);
  } catch {
    // The row exists but the object is gone: say so rather than throwing a 500.
    return new Response("The stored file is missing", { status: 410 });
  }

  const download =
    new URL(request.url).searchParams.get("download") === "1";
  const filename = version.document.name.replace(/["\\]/g, "");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": version.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(version.document.name)}`,
      // Documents are confidential and versioned; never let a cache hold them.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
