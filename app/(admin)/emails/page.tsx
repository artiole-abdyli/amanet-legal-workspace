import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { CopyButton } from "@/components/emails/copy-button";
import { EmailFilters } from "@/components/emails/email-filters";
import { Icon } from "@/components/icons";
import { Badge, type Tone } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Callout, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { SkeletonCard } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatDateTime, formatShortDate, formatTime } from "@/lib/format";
import {
  EMAIL_KINDS,
  emailKind,
  getEmail,
  getEmailStats,
  getEmails,
  type EmailFilters as Filters,
} from "@/lib/queries";

export const metadata = { title: "Email" };

type Search = { [key: string]: string | string[] | undefined };

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

const DOT: Record<string, string> = {
  SENT: "bg-ok",
  QUEUED: "bg-warn",
  FAILED: "bg-danger",
};

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Today's messages show the time; older ones the date. */
function listTime(date: Date) {
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? formatTime(date)
    : formatShortDate(date);
}

/** The subject without its fixed prefix, which the type label already says. */
function shortSubject(subject: string) {
  const kind = emailKind(subject);
  if (!kind) return subject;
  const prefix = EMAIL_KINDS[kind].prefixes.find((p) => subject.startsWith(p));
  return prefix ? subject.slice(prefix.length) : subject;
}

function hrefWith(params: Search, changes: Record<string, string | null>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = one(value);
    if (v !== undefined) next.set(key, v);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `/emails?${query}` : "/emails";
}

/** Plain-text body with its links made clickable. */
function Body({ text }: { text: string }) {
  const parts: ReactNode[] = text.split(URL_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="break-all text-accent underline underline-offset-2 hover:text-accent-hover"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
  return (
    <div className="rounded-lg border border-line bg-bg px-4 py-3.5 text-[13.5px] leading-relaxed whitespace-pre-wrap">
      {parts}
    </div>
  );
}

async function Stats() {
  const stats = await getEmailStats();
  const items: [string, number, string][] = [
    ["Last 7 days", stats.lastWeek, "text-fg"],
    ["Sent", stats.sent, "text-ok"],
    ["Queued", stats.queued, "text-warn"],
    ["Failed", stats.failed, "text-danger"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
      {items.map(([label, value, tone]) => (
        <div key={label} className="bg-surface px-4 py-3">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className={cn("tabular text-xl font-semibold", tone)}>
            {value.toLocaleString("en-GB")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

async function Reader({ id }: { id: string }) {
  const email = await getEmail(id);
  if (!email) {
    return (
      <Card>
        <EmptyState
          icon="mail"
          title="Message not found"
          description="It may have been filtered out. Choose another message from the list."
        />
      </Card>
    );
  }

  const kind = emailKind(email.subject);
  const link = email.body.match(URL_PATTERN)?.[0];

  return (
    <Card as="article" className="gap-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 font-sans text-[16px] leading-snug font-semibold">
          {email.subject}
        </h2>
        <Badge tone={STATUS_TONE[email.status] ?? "neutral"}>
          {STATUS_LABEL[email.status] ?? email.status}
        </Badge>
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
        <dt className="text-muted">To</dt>
        <dd className="font-mono break-all">{email.to}</dd>
        <dt className="text-muted">{email.sentAt ? "Sent" : "Created"}</dt>
        <dd>{formatDateTime(email.sentAt ?? email.createdAt)}</dd>
        {kind ? (
          <>
            <dt className="text-muted">Type</dt>
            <dd>{EMAIL_KINDS[kind].label}</dd>
          </>
        ) : null}
      </dl>

      {email.error ? (
        <div role="alert">
          <Callout tone="warn">
            <b className="font-semibold">Delivery failed.</b> {email.error}
          </Callout>
        </div>
      ) : null}

      <Body text={email.body} />

      {link ? (
        <div className="flex flex-wrap gap-2">
          <CopyButton value={link} />
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses("default", "sm")}
          >
            <Icon name="eye" />
            Open as the client
          </a>
        </div>
      ) : null}
    </Card>
  );
}

async function Outbox({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;

  const filters: Filters = {
    query: one(params.q)?.trim() || undefined,
    status: one(params.status) as Filters["status"],
    kind: one(params.kind) as Filters["kind"],
    page: Number(one(params.page) ?? 1) || 1,
  };

  const { emails, total, pageCount, perPage, page } = await getEmails(filters);
  const filtered = Boolean(filters.query || filters.status || filters.kind);

  if (emails.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={filtered ? "search" : "mail"}
          title={filtered ? "No messages match these filters" : "Nothing sent yet"}
          description={
            filtered
              ? "Try a different search, or clear the filters."
              : "Messages appear here as you request documents, send signature requests and chase clients."
          }
          action={
            filtered ? (
              <Link href="/emails" className={buttonClasses("default", "sm")}>
                Clear filters
              </Link>
            ) : undefined
          }
        />
      </Card>
    );
  }

  const selectedId = one(params.id) ?? emails[0].id;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {emails.map((email) => {
            const selected = email.id === selectedId;
            const kind = emailKind(email.subject);
            return (
              <li key={email.id}>
                <Link
                  href={hrefWith(params, { id: email.id })}
                  scroll={false}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-2.5 transition-colors",
                    selected
                      ? "bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]"
                      : "hover:bg-surface-2",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 rounded-full",
                      DOT[email.status] ?? "bg-neutral",
                    )}
                    aria-label={STATUS_LABEL[email.status] ?? email.status}
                    role="img"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-muted">
                      {email.to}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      {kind ? (
                        <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[11px] font-medium text-muted">
                          {EMAIL_KINDS[kind].label}
                        </span>
                      ) : null}
                      <span className="truncate font-medium">
                        {shortSubject(email.subject)}
                      </span>
                    </span>
                  </span>
                  <time
                    dateTime={(email.sentAt ?? email.createdAt).toISOString()}
                    className="tabular text-xs whitespace-nowrap text-muted"
                  >
                    {listTime(email.sentAt ?? email.createdAt)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>

        <Pagination
          basePath="/emails"
          params={{ ...params, id: undefined }}
          page={page}
          pageCount={pageCount}
          total={total}
          perPage={perPage}
          noun="messages"
        />
      </div>

      <div className="order-first min-w-0 lg:sticky lg:top-5 lg:order-none">
        <Suspense key={selectedId} fallback={<SkeletonCard rows={5} />}>
          <Reader id={selectedId} />
        </Suspense>
      </div>
    </div>
  );
}

export default function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return (
    <>
      <PageHeader
        title="Email"
        description="Every message the workspace has sent, with the secure link it carried."
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] text-muted">
            <Icon name="info" className="size-4" />
            Development outbox
          </span>
        }
      />

      <Suspense fallback={<SkeletonCard rows={1} />}>
        <Stats />
      </Suspense>

      <Suspense fallback={<div className="h-9" />}>
        <EmailFilters />
      </Suspense>

      <Suspense fallback={<SkeletonCard rows={6} />}>
        <Outbox searchParams={searchParams} />
      </Suspense>
    </>
  );
}
