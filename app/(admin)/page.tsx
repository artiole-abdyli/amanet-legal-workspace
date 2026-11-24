import Link from "next/link";
import { Suspense } from "react";

import { Icon, type IconName } from "@/components/icons";
import {
  Card,
  CardHeader,
  PageHeader,
} from "@/components/ui/card";
import { DueDate } from "@/components/ui/meta";
import {
  Skeleton,
  SkeletonCard,
  SkeletonTiles,
} from "@/components/ui/skeleton";
import { Timeline } from "@/components/ui/timeline";
import { cn } from "@/lib/cn";
import {
  daysUntil,
  documentTitle,
  firstName,
  formatDate,
  formatShortDate,
  formatWeekday,
} from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import {
  ATTENTION_PREVIEW,
  getDashboard,
  type AttentionFocus,
} from "@/lib/queries";

export const metadata = { title: "Dashboard" };

type Search = { [key: string]: string | string[] | undefined };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "2 hours ago", "3 days ago": how long something has been waiting. */
function waitingFor(date: Date | null) {
  if (!date) return "";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// --- Summary tiles ------------------------------------------------------------

function Tile({
  icon,
  value,
  label,
  href,
  tone = "neutral",
}: {
  icon: IconName;
  value: number;
  label: string;
  href: string;
  tone?: "neutral" | "accent" | "warn";
}) {
  const active = value > 0 && tone !== "neutral";
  return (
    <Link
      href={href}
      scroll={false}
      className="group flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          active && tone === "accent" && "bg-accent-soft text-accent",
          active && tone === "warn" && "bg-warn-bg text-warn",
          !active && "bg-surface-2 text-muted",
        )}
      >
        <Icon name={icon} className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl leading-tight font-semibold tabular">
          {value}
        </span>
        <span className="block truncate text-[12.5px] text-muted">{label}</span>
      </span>
    </Link>
  );
}

// --- Needs your attention -------------------------------------------------------

type Row = {
  key: string;
  title: string;
  meta: string;
  href: string;
  status: { text: string; tone: "late" | "soon" | "normal" };
};

const TABS: {
  focus: AttentionFocus;
  label: string;
  icon: IconName;
  tone: string;
}[] = [
  { focus: "review", label: "To review", icon: "upload", tone: "bg-info-bg text-info" },
  { focus: "signing", label: "Signing in progress", icon: "pen", tone: "bg-warn-bg text-warn" },
  { focus: "overdue", label: "Overdue tasks", icon: "alert", tone: "bg-danger-bg text-danger" },
];

const EMPTY: Record<AttentionFocus, string> = {
  review: "No client uploads are waiting for review.",
  signing: "Nobody is part-way through signing.",
  overdue: "No task is past its due date.",
};

function AttentionList({
  focus,
  rows,
  total,
  expanded,
}: {
  focus: AttentionFocus;
  rows: Row[];
  total: number;
  expanded: boolean;
}) {
  const tab = TABS.find((t) => t.focus === focus)!;

  if (rows.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-bg px-4 py-6 text-muted">
        <Icon name="check" className="size-4 text-ok" />
        {EMPTY[focus]}
      </p>
    );
  }

  return (
    <>
      <ul className="-mx-2 flex flex-col">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              href={row.href}
              className="group grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className={cn("grid size-7 place-items-center rounded-md", tab.tone)}
              >
                <Icon name={tab.icon} className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.title}</span>
                <span className="block truncate text-[12.5px] text-muted">
                  {row.meta}
                </span>
              </span>
              <span
                className={cn(
                  "hidden text-[12.5px] whitespace-nowrap sm:block",
                  row.status.tone === "late" && "font-medium text-danger",
                  row.status.tone === "soon" && "font-medium text-warn",
                  row.status.tone === "normal" && "text-muted",
                )}
              >
                {row.status.text}
              </span>
              <Icon
                name="arrow"
                className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg"
              />
            </Link>
          </li>
        ))}
      </ul>

      {total > ATTENTION_PREVIEW ? (
        <Link
          href={expanded ? `/?focus=${focus}` : `/?focus=${focus}&all=1`}
          scroll={false}
          className="self-start text-[13px] font-medium text-accent hover:underline"
        >
          {expanded ? "Show fewer" : `Show all ${total}`}
        </Link>
      ) : null}
    </>
  );
}

// --- Page -----------------------------------------------------------------------

async function DashboardContent({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const user = await requireAdmin();

  const requested = one(params.focus) as AttentionFocus | undefined;
  const wantsAll = one(params.all) === "1";
  const data = await getDashboard({
    expand: wantsAll && requested ? requested : undefined,
  });
  const now = new Date();

  const counts: Record<AttentionFocus, number> = {
    review: data.counts.review,
    signing: data.counts.signing,
    overdue: data.counts.overdue,
  };
  const totalAttention = counts.review + counts.signing + counts.overdue;

  // Open on what was asked for, else the first list with something in it.
  const focus: AttentionFocus =
    requested && TABS.some((t) => t.focus === requested)
      ? requested
      : (TABS.find((t) => counts[t.focus] > 0)?.focus ?? "review");

  const rows: Record<AttentionFocus, Row[]> = {
    review: data.submittedRequests.map((request) => ({
      key: request.id,
      title: `${request.title} from ${request.matter.client.name}`,
      meta: `${request.matter.reference} · uploaded through a secure link`,
      href: `/matters/${request.matter.id}?tab=requests`,
      status: { text: waitingFor(request.submittedAt), tone: "normal" },
    })),
    signing: data.liveSignatures.map((signature) => {
      const days = daysUntil(signature.expiresAt, now);
      return {
        key: signature.id,
        title: `${signature.signerName} · ${documentTitle(
          signature.documentVersion.document.name,
        )}`,
        meta: `${signature.matter.reference} · ${
          signature.status === "STARTED" ? "started signing" : "opened, not signed"
        }`,
        href: `/matters/${signature.matter.id}?tab=signatures`,
        status: {
          text:
            days <= 0
              ? "Expires today"
              : `Expires in ${days} day${days === 1 ? "" : "s"}`,
          tone: days <= 3 ? "soon" : "normal",
        },
      };
    }),
    overdue: data.overdueTasks.map((task) => {
      const late = task.dueDate ? -daysUntil(task.dueDate, now) : 0;
      return {
        key: task.id,
        title: task.title,
        meta: `${task.matter.reference} · was due ${formatDate(task.dueDate)}`,
        href: `/matters/${task.matter.id}?tab=tasks`,
        status: {
          text: late <= 0 ? "Due today" : `${late} day${late === 1 ? "" : "s"} late`,
          tone: "late",
        },
      };
    }),
  };

  const moreKeyDates = data.counts.keyDates - data.keyDates.length;

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${firstName(user.name)}`}
        description={`${formatWeekday(now)}, ${formatDate(now)}${
          totalAttention > 0
            ? ` · ${totalAttention} thing${totalAttention === 1 ? "" : "s"} need${
                totalAttention === 1 ? "s" : ""
              } your attention`
            : " · nothing needs your attention"
        }`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon="folder" value={data.counts.openMatters} label="Open matters" href="/matters" />
        <Tile
          icon="pen"
          value={data.counts.awaitingSignature}
          label="Awaiting signature"
          href="/?focus=signing"
          tone="accent"
        />
        <Tile
          icon="upload"
          value={data.counts.uploadsToReview}
          label="Uploads to review"
          href="/?focus=review"
          tone="accent"
        />
        <Tile
          icon="clock"
          value={data.counts.overdue}
          label="Overdue tasks"
          href="/?focus=overdue"
          tone="warn"
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="gap-3">
          <CardHeader title="Needs your attention" />

          <div
            role="tablist"
            aria-label="Attention lists"
            className="flex gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1"
          >
            {TABS.map((tab) => {
              const active = tab.focus === focus;
              return (
                <Link
                  key={tab.focus}
                  role="tab"
                  aria-selected={active}
                  href={`/?focus=${tab.focus}`}
                  scroll={false}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                    active
                      ? "bg-surface text-fg shadow-sm"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11.5px] tabular",
                      counts[tab.focus] > 0 && tab.focus === "overdue"
                        ? "bg-danger-bg text-danger"
                        : counts[tab.focus] > 0
                          ? "bg-accent-soft text-accent"
                          : "bg-surface-2 text-muted",
                    )}
                  >
                    {counts[tab.focus]}
                  </span>
                </Link>
              );
            })}
          </div>

          <AttentionList
            focus={focus}
            rows={rows[focus]}
            total={counts[focus]}
            expanded={wantsAll && requested === focus}
          />
        </Card>

        <Card className="gap-3">
          <CardHeader
            title="Next 14 days"
            aside={
              <span className="text-[12.5px] text-muted">
                {data.counts.keyDates} key date{data.counts.keyDates === 1 ? "" : "s"}
              </span>
            }
          />
          {data.keyDates.length === 0 ? (
            <p className="rounded-lg bg-bg px-4 py-6 text-muted">
              Nothing due in the next two weeks.
            </p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {data.keyDates.map((keyDate) => (
                <li key={keyDate.id}>
                  <Link
                    href={`/matters/${keyDate.matter.id}`}
                    className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
                  >
                    <span className="text-center leading-tight">
                      <span className="block text-[11px] font-medium text-muted uppercase">
                        {formatWeekday(keyDate.date).slice(0, 3)}
                      </span>
                      <span className="block text-[13px] font-semibold tabular">
                        {formatShortDate(keyDate.date)}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{keyDate.label}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {keyDate.matter.title}
                      </span>
                    </span>
                    <DueDate date={keyDate.date} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {moreKeyDates > 0 ? (
            <Link
              href="/matters?sort=deadline"
              className="self-start text-[13px] font-medium text-accent hover:underline"
            >
              {moreKeyDates} more in the next 14 days
            </Link>
          ) : null}
        </Card>
      </div>

      <Card className="gap-3">
        <CardHeader title="Recent activity" />
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
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SkeletonCard rows={5} />
        <SkeletonCard rows={4} />
      </div>
      <SkeletonCard rows={4} />
    </>
  );
}

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
