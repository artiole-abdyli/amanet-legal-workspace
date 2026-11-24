import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { archiveMatter, restoreMatter } from "@/app/actions/matters";
import { Icon } from "@/components/icons";
import { ActivityTab } from "@/components/matters/activity-tab";
import { DocumentsTab } from "@/components/matters/documents-tab";
import { OverviewTab } from "@/components/matters/overview-tab";
import { RequestsTab } from "@/components/matters/requests-tab";
import { SignaturesTab } from "@/components/matters/signatures-tab";
import { StatusSelect } from "@/components/matters/status-select";
import { TasksNotesTab } from "@/components/matters/tasks-notes-tab";
import {
  MATTER_TABS,
  TabNav,
  type MatterTab,
} from "@/components/matters/tab-nav";
import { Badge, matterStatusTone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { DueDate, PriorityMeter } from "@/components/ui/meta";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { formatDate, matterStatusLabel } from "@/lib/format";
import { getMatter } from "@/lib/queries";

type Params = Promise<{ id: string }>;
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

function TabContent({ matterId, tab }: { matterId: string; tab: MatterTab }) {
  switch (tab) {
    case "documents":
      return <DocumentsTab matterId={matterId} />;
    case "requests":
      return <RequestsTab matterId={matterId} />;
    case "signatures":
      return <SignaturesTab matterId={matterId} />;
    case "tasks":
      return <TasksNotesTab matterId={matterId} />;
    case "activity":
      return <ActivityTab matterId={matterId} />;
    default:
      return <OverviewTab matterId={matterId} />;
  }
}

async function MatterView({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const raw = (await searchParams).tab;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const tab: MatterTab = MATTER_TABS.includes(value as MatterTab)
    ? (value as MatterTab)
    : "overview";

  const matter = await getMatter(id);
  if (!matter) notFound();

  const archived = matter.archivedAt !== null;

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-muted"
      >
        <Link href="/matters" className="hover:text-fg">
          Matters
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-mono text-[13px]">{matter.reference}</span>
      </nav>

      {archived ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-neutral-bg px-4 py-3">
          <span className="flex items-center gap-2.5">
            <Icon name="archive" />
            This matter is archived. Its documents and history are kept, but it
            is hidden from the matters list.
          </span>
          <form action={restoreMatter.bind(null, matter.id)}>
            <Button type="submit" size="sm">
              Restore matter
            </Button>
          </form>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-2.5">
          <h1 className="font-serif text-[26px] leading-tight font-semibold tracking-[-0.015em]">
            {matter.title}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted">
            <span>
              Client:{" "}
              <Link
                href="/clients"
                className="font-medium text-fg underline-offset-2 hover:underline"
              >
                {matter.client.name}
              </Link>
            </span>
            <span>{matter.practiceArea}</span>
            <span>Opened {formatDate(matter.openedAt)}</span>
            <span className="font-mono">{matter.reference}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              tone={archived ? "neutral" : matterStatusTone[matter.status]}
            >
              {archived ? "Archived" : matterStatusLabel[matter.status]}
            </Badge>
            <PriorityMeter priority={matter.priority} />
            {matter.deadline && matter.status !== "CLOSED" ? (
              <DueDate date={matter.deadline} prefix="Deadline" />
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect
            matterId={matter.id}
            status={matter.status}
            disabled={archived}
          />
          {archived ? null : (
            <Link
              href={`/matters/${matter.id}/edit`}
              className={buttonClasses("default")}
            >
              <Icon name="pen" />
              Edit
            </Link>
          )}
          <Link
            href={`/matters/${matter.id}/request-documents`}
            className={buttonClasses("default")}
          >
            <Icon name="upload" />
            Request documents
          </Link>
          <Link
            href={`/matters/${matter.id}/request-signature`}
            className={buttonClasses("primary")}
          >
            <Icon name="pen" />
            Request signature
          </Link>
          {archived ? null : (
            <form action={archiveMatter.bind(null, matter.id)}>
              <Button
                type="submit"
                variant="ghost"
                aria-label="Archive matter"
                className="px-2.5"
              >
                <Icon name="archive" />
              </Button>
            </form>
          )}
        </div>
      </div>

      <TabNav
        matterId={matter.id}
        current={tab}
        counts={{
          documents: matter._count.documents,
          requests: matter._count.documentRequests,
          signatures: matter._count.signatureRequests,
          tasks: matter._count.tasks,
        }}
      />

      <Suspense key={tab} fallback={<SkeletonCard rows={4} />}>
        <TabContent matterId={matter.id} tab={tab} />
      </Suspense>
    </>
  );
}

function MatterFallback() {
  return (
    <>
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-6 w-56" />
      </div>
      <Skeleton className="h-10 w-full" />
      <SkeletonCard rows={4} />
    </>
  );
}

export default function MatterPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  return (
    <Suspense fallback={<MatterFallback />}>
      <MatterView params={params} searchParams={searchParams} />
    </Suspense>
  );
}
