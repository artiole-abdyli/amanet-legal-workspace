import Link from "next/link";
import { Suspense } from "react";

import { Icon, type IconName } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  SectionTitle,
} from "@/components/ui/card";
import { CalendarTile, DueDate } from "@/components/ui/meta";
import {
  Skeleton,
  SkeletonCard,
  SkeletonTiles,
} from "@/components/ui/skeleton";
import { Timeline } from "@/components/ui/timeline";
import { cn } from "@/lib/cn";
import {
  documentTitle,
  firstName,
  formatDate,
  formatWeekday,
} from "@/lib/format";
import { getAdminUser, getDashboard } from "@/lib/queries";

export const metadata = { title: "Dashboard" };

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Tile({
  value,
  label,
  href,
  highlight,
}: {
  value: number;
  label: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4 transition-colors hover:border-line-strong"
    >
      <span
        className={cn(
          "font-serif text-3xl leading-none font-semibold tabular",
          highlight && "text-accent",
        )}
      >
        {value}
      </span>
      <span className="text-[13px] text-muted">{label}</span>
    </Link>
  );
}

type AttentionItem = {
  key: string;
  icon: IconName;
  tone: "info" | "warn" | "danger";
  title: string;
  detail: string;
  href: string;
  action: string;
};

const ATTENTION_TONES = {
  info: "bg-info-bg text-info",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
};

async function DashboardContent() {
  const [user, data] = await Promise.all([getAdminUser(), getDashboard()]);
  const now = new Date();

  const attention: AttentionItem[] = [
    ...data.submittedRequests.map((request) => ({
      key: `request-${request.id}`,
      icon: "upload" as const,
      tone: "info" as const,
      title: `Review ${request.title.toLowerCase()} from ${request.matter.client.name}`,
      detail: `${request.matter.reference} · uploaded through a secure link`,
      href: `/matters/${request.matter.id}?tab=requests`,
      action: "Review",
    })),
    ...data.liveSignatures.map((signature) => ({
      key: `signature-${signature.id}`,
      icon: "pen" as const,
      tone: "warn" as const,
      title: `${signature.signerName} ${
        signature.status === "STARTED" ? "started signing" : "opened"
      } ${documentTitle(signature.documentVersion.document.name)} but hasn't finished`,
      detail: `${signature.matter.reference} · link expires ${formatDate(signature.expiresAt)}`,
      href: `/matters/${signature.matter.id}?tab=signatures`,
      action: "View",
    })),
    ...data.overdueTasks.map((task) => ({
      key: `task-${task.id}`,
      icon: "alert" as const,
      tone: "danger" as const,
      title: `Overdue: ${task.title}`,
      detail: `${task.matter.reference} · was due ${formatDate(task.dueDate)}`,
      href: `/matters/${task.matter.id}?tab=tasks`,
      action: "Open",
    })),
  ];

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${firstName(user.name)}`}
        description={`${formatWeekday(now)}, ${formatDate(now)}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          value={data.counts.openMatters}
          label="Open matters"
          href="/matters"
        />
        <Tile
          value={data.counts.awaitingSignature}
          label="Awaiting signature"
          href="/matters"
          highlight={data.counts.awaitingSignature > 0}
        />
        <Tile
          value={data.counts.uploadsToReview}
          label="Uploads to review"
          href="/matters"
          highlight={data.counts.uploadsToReview > 0}
        />
        <Tile
          value={data.counts.keyDates}
          label="Key dates in 14 days"
          href="/matters"
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Needs your attention"
            aside={
              <span className="text-muted">
                {attention.length} item{attention.length === 1 ? "" : "s"}
              </span>
            }
          />
          {attention.length === 0 ? (
            <EmptyState
              icon="check"
              title="You're all caught up"
              description="New uploads and signature activity will show here."
            />
          ) : (
            <ul className="flex flex-col">
              {attention.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0"
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-lg",
                      ATTENTION_TONES[item.tone],
                    )}
                  >
                    <Icon name={item.icon} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    {item.title}
                    <small className="block text-muted">{item.detail}</small>
                  </span>
                  <Link
                    href={item.href}
                    className={buttonClasses("default", "sm")}
                  >
                    {item.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>Upcoming key dates</SectionTitle>
          {data.keyDates.length === 0 ? (
            <p className="text-muted">Nothing in the next 14 days.</p>
          ) : (
            <ul className="flex flex-col">
              {data.keyDates.map((keyDate) => (
                <li
                  key={keyDate.id}
                  className="flex items-center gap-3.5 border-t border-line py-2.5 first:border-t-0 first:pt-0"
                >
                  <CalendarTile date={keyDate.date} />
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/matters/${keyDate.matter.id}`}
                      className="font-medium text-fg underline-offset-2 hover:underline"
                    >
                      {keyDate.label}
                    </Link>
                    <small className="block truncate text-muted">
                      {keyDate.matter.title}
                    </small>
                  </span>
                  <DueDate date={keyDate.date} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>Recent activity across matters</SectionTitle>
        <Timeline
          entries={data.recentActivity.map((event) => ({
            id: event.id,
            type: event.type,
            summary: event.summary,
            actorName: event.actorName,
            createdAt: event.createdAt,
            matter: event.matter,
          }))}
          showMatter
        />
      </Card>
    </>
  );
}

function DashboardFallback() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-40" />
      </div>
      <SkeletonTiles />
      <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_minmax(0,1fr)]">
        <SkeletonCard rows={4} />
        <SkeletonCard rows={3} />
      </div>
      <SkeletonCard rows={4} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}
