import Link from "next/link";
import { Suspense } from "react";

import { MatterFilters } from "@/components/matters/matter-filters";
import { Badge, matterStatusTone } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Chip, DueDate, PriorityMeter } from "@/components/ui/meta";
import { SkeletonTable } from "@/components/ui/skeleton";
import { matterStatusLabel } from "@/lib/format";
import {
  getMatterCount,
  getMatters,
  type MatterFilters as Filters,
} from "@/lib/queries";

export const metadata = { title: "Matters" };

type Matter = Awaited<ReturnType<typeof getMatters>>[number];

/** The next date the firm has to hit, which is what the column is really for. */
function nextKeyDate(matter: Matter) {
  const now = new Date();
  const upcoming = matter.keyDates.find((keyDate) => keyDate.date >= now);
  if (upcoming) return { label: upcoming.label, date: upcoming.date };
  if (matter.deadline) return { label: "Deadline", date: matter.deadline };
  return null;
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function MattersTable({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const filters: Filters = {
    query: one(params.q)?.trim() || undefined,
    status: one(params.status) as Filters["status"],
    priority: one(params.priority) as Filters["priority"],
    includeArchived: one(params.archived) === "1",
    sort: (one(params.sort) as Filters["sort"]) ?? "deadline",
  };

  const [matters, total] = await Promise.all([
    getMatters(filters),
    getMatterCount(),
  ]);

  if (matters.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="search"
          title="No matters match these filters"
          description="Try a different search, or clear the filters to see everything."
          action={
            <Link href="/matters" className={buttonClasses("default", "sm")}>
              Clear filters
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="bg-surface-2 text-left">
              {[
                "Matter",
                "Client",
                "Status",
                "Priority",
                "Next key date",
                "Open items",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="border-b border-line px-4 py-2.5 font-sans text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matters.map((matter) => {
              const key = nextKeyDate(matter);
              const archived = matter.archivedAt !== null;
              return (
                <tr
                  key={matter.id}
                  className="border-b border-line last:border-b-0 hover:bg-bg"
                >
                  <td className="px-4 py-3.5 align-middle">
                    <Link
                      href={`/matters/${matter.id}`}
                      className="font-semibold text-fg underline-offset-2 hover:underline"
                    >
                      {matter.title}
                    </Link>
                    <small className="block font-mono text-[11.5px] text-muted">
                      {matter.reference} · {matter.practiceArea}
                    </small>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    {matter.client.name}
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <Badge
                      tone={
                        archived ? "neutral" : matterStatusTone[matter.status]
                      }
                    >
                      {archived ? "Archived" : matterStatusLabel[matter.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <PriorityMeter priority={matter.priority} />
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    {archived || matter.status === "CLOSED" || !key ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <>
                        <div>{key.label}</div>
                        <DueDate date={key.date} />
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <div className="flex flex-wrap gap-1.5">
                      {matter._count.documentRequests > 0 ? (
                        <Chip>{matter._count.documentRequests} to review</Chip>
                      ) : null}
                      {matter._count.signatureRequests > 0 ? (
                        <Chip>
                          {matter._count.signatureRequests} awaiting signature
                        </Chip>
                      ) : null}
                      {matter._count.tasks > 0 ? (
                        <Chip>
                          {matter._count.tasks} task
                          {matter._count.tasks === 1 ? "" : "s"}
                        </Chip>
                      ) : null}
                      {matter._count.documentRequests === 0 &&
                      matter._count.signatureRequests === 0 &&
                      matter._count.tasks === 0 ? (
                        <span className="text-muted">None</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted">
        {matters.length} of {total} matters
      </p>
    </>
  );
}

export default function MattersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <>
      {/* No "New matter" button here: the one in the top bar is on every page,
          and two of the same action side by side is just noise. */}
      <PageHeader
        title="Matters"
        description="Every case and piece of work the firm has open."
      />

      <Suspense fallback={<div className="h-10" />}>
        <MatterFilters />
      </Suspense>

      <Suspense fallback={<SkeletonTable />}>
        <MattersTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}
