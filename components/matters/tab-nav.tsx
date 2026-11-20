import Link from "next/link";

import { cn } from "@/lib/cn";

export const MATTER_TABS = [
  "overview",
  "documents",
  "requests",
  "signatures",
  "tasks",
  "activity",
] as const;

export type MatterTab = (typeof MATTER_TABS)[number];

const LABELS: Record<MatterTab, string> = {
  overview: "Overview",
  documents: "Documents",
  requests: "Client requests",
  signatures: "Signatures",
  tasks: "Tasks & notes",
  activity: "Activity",
};

/**
 * Tabs are links, not state, so a tab can be opened directly from a
 * notification or an email and the browser's back button behaves.
 */
export function TabNav({
  matterId,
  current,
  counts,
}: {
  matterId: string;
  current: MatterTab;
  counts: Partial<Record<MatterTab, number>>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Matter sections"
      className="flex gap-1 overflow-x-auto border-b border-line"
    >
      {MATTER_TABS.map((tab) => {
        const active = tab === current;
        const count = counts[tab];
        return (
          <Link
            key={tab}
            role="tab"
            aria-selected={active}
            href={
              tab === "overview"
                ? `/matters/${matterId}`
                : `/matters/${matterId}?tab=${tab}`
            }
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 font-medium whitespace-nowrap transition-colors",
              active
                ? "border-accent text-fg"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {LABELS[tab]}
            {count !== undefined ? (
              <span className="rounded-full bg-surface-2 px-1.5 text-[11.5px] text-muted">
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
