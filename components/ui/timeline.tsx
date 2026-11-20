import Link from "next/link";

import { Icon, type IconName } from "@/components/icons";
import { EmptyState } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatWeekday,
} from "@/lib/format";

type ActivityType =
  | "MATTER"
  | "DOCUMENT"
  | "REQUEST"
  | "SIGNATURE"
  | "TASK"
  | "NOTE";

const ICONS: Record<ActivityType, IconName> = {
  MATTER: "folder",
  DOCUMENT: "file",
  REQUEST: "upload",
  SIGNATURE: "pen",
  TASK: "task",
  NOTE: "note",
};

const DOT_TONES: Record<ActivityType, string> = {
  MATTER: "bg-surface-2 text-muted",
  DOCUMENT: "bg-surface-2 text-muted",
  REQUEST: "bg-info-bg text-info",
  SIGNATURE: "bg-accent-soft text-accent",
  TASK: "bg-surface-2 text-muted",
  NOTE: "bg-surface-2 text-muted",
};

export type TimelineEntry = {
  id: string;
  type: ActivityType;
  summary: string;
  actorName: string;
  createdAt: Date;
  matter?: { id: string; reference: string } | null;
};

function Entry({
  entry,
  showMatter,
  timeOnly,
}: {
  entry: TimelineEntry;
  showMatter?: boolean;
  timeOnly?: boolean;
}) {
  return (
    <li className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-4 last:pb-0 [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:top-7 [&:not(:last-child)]:before:bottom-0.5 [&:not(:last-child)]:before:left-[13.5px] [&:not(:last-child)]:before:w-px [&:not(:last-child)]:before:bg-line">
      <span
        className={cn(
          "grid size-7 place-items-center rounded-full",
          DOT_TONES[entry.type],
        )}
      >
        <Icon name={ICONS[entry.type]} className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="pt-0.5">{entry.summary}</p>
        <small className="text-[12.5px] text-muted">
          {timeOnly ? formatTime(entry.createdAt) : formatDateTime(entry.createdAt)}
          {" · "}
          {entry.actorName}
          {showMatter && entry.matter ? (
            <>
              {" · "}
              <Link
                href={`/matters/${entry.matter.id}`}
                className="underline-offset-2 hover:underline"
              >
                {entry.matter.reference}
              </Link>
            </>
          ) : null}
        </small>
      </div>
    </li>
  );
}

export function Timeline({
  entries,
  showMatter,
}: {
  entries: TimelineEntry[];
  showMatter?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon="clock"
        title="No activity yet"
        description="Events appear here as documents, tasks and signatures change."
      />
    );
  }

  return (
    <ol className="flex flex-col">
      {entries.map((entry) => (
        <Entry key={entry.id} entry={entry} showMatter={showMatter} />
      ))}
    </ol>
  );
}

/** The matter history, where grouping by day is what makes it readable. */
export function GroupedTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon="clock"
        title="No activity yet"
        description="Every document, task and signature event on this matter is recorded here."
      />
    );
  }

  const groups = new Map<string, TimelineEntry[]>();
  for (const entry of entries) {
    const key = formatDate(entry.createdAt);
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }

  const today = formatDate(new Date());

  return (
    <div className="flex flex-col gap-5">
      {[...groups].map(([day, items]) => (
        <div key={day}>
          <h3 className="mb-3 font-sans text-xs font-semibold tracking-[0.06em] text-muted uppercase">
            {day === today ? "Today" : `${formatWeekday(items[0].createdAt)}, ${day}`}
          </h3>
          <ol className="flex flex-col">
            {items.map((entry) => (
              <Entry key={entry.id} entry={entry} timeOnly />
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
