import { openSignedCopy } from "@/lib/link-access";
import { rateLimit } from "@/lib/rate-limit";
import { getObject } from "@/lib/storage";

/**
 * The signer's own copy of what they signed, with its certificate page.
 *
 * Reached from the confirmation page and the "your signed copy" email. The
 * spent signing link is the only key, and it opens nothing else.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limit = rateLimit(`signed-copy:${token}`, 30, 60_000);
  if (!limit.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfter) },
    });
  }

  const copy = await openSignedCopy(token);
  if (!copy) {
    return new Response(
      "This download is no longer available. Contact the firm for a copy.",
      { status: 404 },
    );
  }

  const bytes = await getObject(copy.storageKey);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": copy.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(copy.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
