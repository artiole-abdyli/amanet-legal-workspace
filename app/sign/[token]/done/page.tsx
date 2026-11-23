import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ClientShell, ClientState } from "@/components/client/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { documentTitle, firstName, formatDateTime } from "@/lib/format";
import { openCompletedSigningLink } from "@/lib/link-access";
import { getFirm } from "@/lib/queries";

export const metadata = { title: "Signed" };

type Params = Promise<{ token: string }>;

/**
 * The page a client lands on after signing.
 *
 * Signing redirects here instead of swapping the page out underneath the
 * client, so the confirmation survives a refresh and the browser's back button
 * cannot replay the submission.
 */
async function Done({ params }: { params: Params }) {
  const { token } = await params;
  const [firm, signature] = await Promise.all([
    getFirm(),
    openCompletedSigningLink(token),
  ]);

  if (!signature) notFound();

  const title = documentTitle(signature.documentVersion.document.name);

  return (
    <ClientShell firmName={firm.name} mode="Secure signing">
      <ClientState
        tone="ok"
        icon="check"
        title={`Thank you, ${firstName(signature.signerName)}. It is signed.`}
        extra={
          <dl className="mt-2 w-full max-w-[460px] rounded-card border border-line bg-bg px-4 py-3.5 text-left">
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-muted">Document</dt>
              <dd className="min-w-0 text-right">{title}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-muted">Signed</dt>
              <dd>{formatDateTime(signature.signedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-muted">Matter</dt>
              <dd className="font-mono text-[13px]">
                {signature.matter.reference}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-muted">Copy sent to</dt>
              <dd className="min-w-0 text-right font-mono text-[13px] break-all">
                {signature.signerEmail}
              </dd>
            </div>
          </dl>
        }
      >
        {firm.name} has been notified. A signed copy with its certificate of
        completion has been emailed to you. You can close this page.
      </ClientState>
    </ClientShell>
  );
}

function DoneFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-4 px-4 py-16">
      <Skeleton className="size-14 rounded-full" />
      <Skeleton className="h-7 w-72 max-w-full" />
      <Skeleton className="h-4 w-full max-w-[42ch]" />
    </div>
  );
}

export default function SignedPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<DoneFallback />}>
      <Done params={params} />
    </Suspense>
  );
}
