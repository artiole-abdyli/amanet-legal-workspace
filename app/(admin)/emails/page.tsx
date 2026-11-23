import { Suspense } from "react";

import { Icon } from "@/components/icons";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { SkeletonCard } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { getEmails } from "@/lib/queries";

export const metadata = { title: "Email" };

const STATUS_TONE: Record<string, Tone> = {
  SENT: "ok",
  QUEUED: "warn",
  FAILED: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  SENT: "Sent",
  QUEUED: "Queued",
  FAILED: "Failed",
};

async function Outbox({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.page;
  const page = Number((Array.isArray(raw) ? raw[0] : raw) ?? 1) || 1;

  const { emails, total, pageCount, perPage, page: current } =
    await getEmails(page);

  if (emails.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="mail"
          title="Nothing sent yet"
          description="Messages appear here as you request documents, send signature requests and chase clients."
        />
      </Card>
    );
  }

  return (
    <>
      {emails.map((email) => (
        <Card key={email.id} as="article" className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-sans text-[15.5px] font-semibold">
                {email.subject}
              </h2>
              <p className="text-muted">
                To <span className="font-mono text-[13px]">{email.to}</span>
                {" · "}
                {formatDateTime(email.sentAt ?? email.createdAt)}
              </p>
            </div>
            <Badge tone={STATUS_TONE[email.status] ?? "neutral"}>
              {STATUS_LABEL[email.status] ?? email.status}
            </Badge>
          </div>

          <pre className="overflow-x-auto rounded-lg bg-bg p-3.5 font-sans text-[13.5px] whitespace-pre-wrap text-fg">
            {email.body}
          </pre>

          {email.error ? (
            <p className="font-medium text-danger">{email.error}</p>
          ) : null}
        </Card>
      ))}

      <Pagination
        basePath="/emails"
        params={params}
        page={current}
        pageCount={pageCount}
        total={total}
        perPage={perPage}
        noun="messages"
      />
    </>
  );
}

export default function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <>
      <PageHeader
        title="Email"
        description="Every message the workspace has sent to a client, with the secure link it carried."
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">
            <Icon name="info" className="size-4" />
            Development outbox
          </span>
        }
      />

      <Suspense fallback={<SkeletonCard rows={4} />}>
        <Outbox searchParams={searchParams} />
      </Suspense>
    </>
  );
}
