import { Suspense } from "react";

import {
  ClientIntro,
  ClientShell,
  ClientState,
  MetaItem,
} from "@/components/client/shell";
import { UploadForm } from "@/components/client/upload-form";
import { Callout } from "@/components/ui/card";
import { DueDate } from "@/components/ui/meta";
import { Skeleton } from "@/components/ui/skeleton";
import { firstName, formatDate } from "@/lib/format";
import { openUploadLink } from "@/lib/link-access";
import { getFirm } from "@/lib/queries";

export const metadata = { title: "Upload a document" };

type Params = Promise<{ token: string }>;

async function UploadView({ params }: { params: Params }) {
  const { token } = await params;
  const [firm, result] = await Promise.all([getFirm(), openUploadLink(token)]);

  if (!result.ok) {
    const copy = {
      revoked: {
        tone: "bad" as const,
        icon: "ban" as const,
        title: "This link is no longer active",
        body: "The firm cancelled this upload request. Contact your lawyer if you still need to send the document.",
      },
      expired: {
        tone: "neutral" as const,
        icon: "clock" as const,
        title: "This link has expired",
        body: "For your security, upload links stop working after a set time. Ask your lawyer to send you a new one.",
      },
      used: {
        tone: "ok" as const,
        icon: "check" as const,
        title: "This link has already been used",
        body: "The document attached to this link has been received.",
      },
      "wrong-purpose": {
        tone: "bad" as const,
        icon: "ban" as const,
        title: "This link does not open an upload page",
        body: "Check the email you received, or ask your lawyer for the right link.",
      },
      "not-found": {
        tone: "bad" as const,
        icon: "ban" as const,
        title: "We could not find this link",
        body: "The address may have been copied incompletely. Open the link straight from the email you were sent.",
      },
    }[result.reason];

    return (
      <ClientShell firmName={firm.name} mode="Secure upload">
        <ClientState tone={copy.tone} icon={copy.icon} title={copy.title}>
          {copy.body}
        </ClientState>
      </ClientShell>
    );
  }

  const request = result.target;
  const recipient =
    request.matter.client.contactName ?? request.matter.client.name;
  const done = request.status === "SUBMITTED" || request.status === "ACCEPTED";

  return (
    <ClientShell firmName={firm.name} mode="Secure upload">
      <ClientIntro
        eyebrow="Document requested"
        title={
          done
            ? "Thank you, we have your document"
            : `${firstName(recipient)}, we need a document from you`
        }
        meta={
          <>
            <MetaItem icon="clock">
              Link expires {formatDate(result.expiresAt)}
            </MetaItem>
            <MetaItem icon="shield">Encrypted connection</MetaItem>
          </>
        }
      >
        For your matter, <b className="text-fg">{request.matter.title}</b> (
        {request.matter.reference}). Files go straight to your lawyer and are
        stored securely.
      </ClientIntro>

      <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-sans text-[16.5px] font-semibold">
              {request.title}
            </h2>
            <p className="mt-0.5 text-muted">{request.description}</p>
          </div>
          {request.dueDate && !done ? (
            <DueDate date={request.dueDate} prefix="Needed" />
          ) : null}
        </div>

        {request.status === "CHANGES_REQUESTED" && request.reviewNote ? (
          <Callout tone="warn">
            <b>Your lawyer asked for a new copy.</b> {request.reviewNote}
          </Callout>
        ) : null}

        {request.status === "SUBMITTED" ? (
          <p className="text-muted">
            We received {request.submittedDocument?.name}. Your lawyer will
            review it and let you know if anything else is needed.
          </p>
        ) : request.status === "ACCEPTED" ? (
          <p className="text-muted">
            This document has been accepted. There is nothing more to do.
          </p>
        ) : (
          <UploadForm token={token} />
        )}
      </article>
    </ClientShell>
  );
}

function UploadFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-8">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-9 w-80 max-w-full" />
      <Skeleton className="h-4 w-full max-w-[52ch]" />
      <Skeleton className="h-48 w-full rounded-card" />
    </div>
  );
}

export default function UploadPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<UploadFallback />}>
      <UploadView params={params} />
    </Suspense>
  );
}
