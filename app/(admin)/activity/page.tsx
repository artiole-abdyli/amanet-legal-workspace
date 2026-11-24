import Link from "next/link";
import { Suspense } from "react";

import { ActivityFilters } from "@/components/activity/activity-filters";
import { buttonClasses } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { SkeletonCard } from "@/components/ui/skeleton";
import { GroupedTimeline } from "@/components/ui/timeline";
import { getActivity, type ActivityFilters as Filters } from "@/lib/queries";

export const metadata = { title: "Activity" };

type Search = { [key: string]: string | string[] | undefined };

const TYPES: NonNullable<Filters["type"]>[] = [
  "MATTER",
  "DOCUMENT",
  "REQUEST",
  "SIGNATURE",
  "TASK",
  "NOTE",
];
const ACTORS: NonNullable<Filters["actor"]>[] = ["ADMIN", "CLIENT", "SYSTEM"];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Only values the log knows; anything else in the URL is ignored. */
function pick<T extends string>(value: string | undefined, allowed: T[]) {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

async function ActivityLog({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;

  const filters: Filters = {
    query: one(params.q)?.trim() || undefined,
    type: pick(one(params.type), TYPES),
    actor: pick(one(params.actor), ACTORS),
    page: Number(one(params.page) ?? 1) || 1,
  };

  const { events, total, page, pageCount, perPage } = await getActivity(filters);
  const filtered = Boolean(filters.query || filters.type || filters.actor);

  if (events.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={filtered ? "search" : "clock"}
          title={filtered ? "Nothing matches these filters" : "No activity yet"}
          description={
            filtered
              ? "Try a different search, or clear the filters."
              : "Every document, request, signature and task change is recorded here."
          }
          action={
            filtered ? (
              <Link href="/activity" className={buttonClasses("default", "sm")}>
                Clear filters
              </Link>
            ) : undefined
          }
        />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <GroupedTimeline
          showMatter
          entries={events.map((event) => ({
            id: event.id,
            type: event.type,
            summary: event.summary,
            actorName: event.actorName,
            createdAt: event.createdAt,
            matter: event.matter,
          }))}
        />
      </Card>

      <Pagination
        basePath="/activity"
        params={params}
        page={page}
        pageCount={pageCount}
        total={total}
        perPage={perPage}
        noun="events"
      />
    </>
  );
}

export default function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return (
    <>
      <PageHeader
        title="Activity"
        description="Everything that has happened across the firm's matters, newest first. Each matter also keeps its own history."
      />

      <Suspense fallback={<div className="h-10" />}>
        <ActivityFilters />
      </Suspense>

      <Suspense fallback={<SkeletonCard rows={6} />}>
        <ActivityLog searchParams={searchParams} />
      </Suspense>
    </>
  );
}
