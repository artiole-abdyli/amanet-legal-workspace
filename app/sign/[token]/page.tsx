import { Suspense } from "react";

import { MarkViewed } from "@/components/client/mark-viewed";
import { SignFlow } from "@/components/client/sign-flow";
import {
  ClientIntro,
  ClientShell,
  ClientState,
  MetaItem,
} from "@/components/client/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { documentTitle, firstName, formatDate, formatDateTime } from "@/lib/format";
import { openSigningLink } from "@/lib/link-access";
import { getFirm } from "@/lib/queries";

export const metadata = { title: "Sign a document" };

type Params = Promise<{ token: string }>;

async function SignView({ params }: { params: Params }) {
  const { token } = await params;
  const [firm, result] = await Promise.all([getFirm(), openSigningLink(token)]);

  if (!result.ok) {
    const copy = {
      revoked: {
        title: "This link is no longer active",
        body: "The firm cancelled this signing request, so the document cannot be signed here. If you think this is a mistake, contact your lawyer.",
        icon: "ban" as const,
        tone: "bad" as const,
      },
      expired: {
        title: "This link has expired",
        body: "For your security, signing links stop working after a set time. Ask your lawyer to send you a new one.",
        icon: "clock" as const,
        tone: "neutral" as const,
      },
      used: {
        title: "This link has already been used",
        body: "The document attached to this link has been signed. A signed copy was emailed to you.",
        icon: "check" as const,
        tone: "ok" as const,
      },
      "wrong-purpose": {
        title: "This link does not open a document to sign",
        body: "Check the email you received, or ask your lawyer to send the right link.",
        icon: "ban" as const,
        tone: "bad" as const,
      },
      "not-found": {
        title: "We could not find this link",
        body: "The address may have been copied incompletely. Open the link straight from the email you were sent.",
        icon: "ban" as const,
        tone: "bad" as const,
      },
    }[result.reason];

    return (
      <ClientShell firmName={firm.name} mode="Secure signing">
        <ClientState tone={copy.tone} icon={copy.icon} title={copy.title}>
          {copy.body}
        </ClientState>
      </ClientShell>
    );
  }

  const signature = result.target;
  const title = documentTitle(signature.documentVersion.document.name);

  if (signature.status === "SIGNED") {
    return (
      <ClientShell firmName={firm.name} mode="Secure signing">
        <ClientState tone="ok" icon="check" title="You have already signed this">
          You signed {title} on {formatDateTime(signature.signedAt)}. A signed
          copy was emailed to {signature.signerEmail}.
        </ClientState>
      </ClientShell>
    );
  }

  if (signature.status === "REVOKED" || signature.status === "EXPIRED") {
    return (
      <ClientShell firmName={firm.name} mode="Secure signing">
        <ClientState tone="bad" icon="ban" title="This request was cancelled">
          {signature.revokedReason
            ? `The firm cancelled this signing request: ${signature.revokedReason}.`
            : "The firm cancelled this signing request."}{" "}
          Contact your lawyer if you were expecting to sign.
        </ClientState>
      </ClientShell>
    );
  }

  return (
    <ClientShell firmName={firm.name} mode="Secure signing">
      <MarkViewed token={token} />
      <ClientIntro
        eyebrow="Signature requested"
        title={`${firstName(signature.signerName)}, please review and sign`}
        meta={
          <>
            <MetaItem icon="file">
              Version {signature.documentVersion.versionNo}
            </MetaItem>
            <MetaItem icon="clock">
              Link expires {formatDate(signature.expiresAt)}
            </MetaItem>
            <MetaItem icon="shield">Encrypted connection</MetaItem>
          </>
        }
      >
        {firm.name} has asked you to sign <b className="text-fg">{title}</b> for
        your matter, <b className="text-fg">{signature.matter.title}</b>.
      </ClientIntro>

      <SignFlow
        token={token}
        signerName={signature.signerName}
        signerEmail={signature.signerEmail}
        documentName={title}
        matterReference={signature.matter.reference}
        pdfUrl={`/sign/${token}/document`}
      />
    </ClientShell>
  );
}

function SignFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-9 w-80 max-w-full" />
      <Skeleton className="h-4 w-full max-w-[52ch]" />
      <Skeleton className="h-[62vh] min-h-[420px] w-full rounded-card" />
    </div>
  );
}

export default function SignPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<SignFallback />}>
      <SignView params={params} />
    </Suspense>
  );
}
