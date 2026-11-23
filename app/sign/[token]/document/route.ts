import { openSigningLink } from "@/lib/link-access";
import { rateLimit } from "@/lib/rate-limit";
import { getObject } from "@/lib/storage";

/**
 * Serves the document a signing link points at.
 *
 * The client never learns a document id: the token is the only thing that opens
 * this, and it is re-checked here exactly as it is on the page itself.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limit = rateLimit(`sign-doc:${token}`, 60, 60_000);
  if (!limit.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfter) },
    });
  }

  const result = await openSigningLink(token);

  if (!result.ok) {
    return new Response("This link is no longer valid", { status: 404 });
  }

  const version = result.target.documentVersion;
  const bytes = await getObject(version.storageKey);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": version.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(version.document.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
