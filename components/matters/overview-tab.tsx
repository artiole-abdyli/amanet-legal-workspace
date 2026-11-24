import Link from "next/link";

import { Icon } from "@/components/icons";
import { Card, SectionTitle } from "@/components/ui/card";
import { CalendarTile, DueDate } from "@/components/ui/meta";
import { Timeline } from "@/components/ui/timeline";
import { daysUntil, formatDate } from "@/lib/format";
import { getMatter, getMatterOverview } from "@/lib/queries";

function OutstandingRow({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <span>{label}</span>
      <span className="flex items-center gap-3">
        <b className="font-serif text-xl font-semibold tabular">{value}</b>
        <Link
          href={href}
          aria-label={`Open ${label.toLowerCase()}`}
          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Icon name="arrow" className="size-4" />
        </Link>
      </span>
    </li>
  );
}

export async function OverviewTab({ matterId }: { matterId: string }) {
  const [matter, overview] = await Promise.all([
    getMatter(matterId),
    getMatterOverview(matterId),
  ]);
  if (!matter) return null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <SectionTitle>Key dates</SectionTitle>
            {matter.archivedAt ? null : (
              <Link
                href={`/matters/${matter.id}/edit`}
                className="text-[13px] font-medium text-accent hover:underline"
              >
                Add or change
              </Link>
            )}
          </div>
          {matter.keyDates.length === 0 ? (
            <p className="text-muted">No key dates recorded for this matter.</p>
          ) : (
            <ul className="flex flex-col">
              {matter.keyDates.map((keyDate) => (
                <li
                  key={keyDate.id}
                  className="flex items-center gap-3.5 border-t border-line py-2.5 first:border-t-0 first:pt-0"
                >
                  <CalendarTile date={keyDate.date} />
                  <span className="min-w-0 flex-1">
                    {keyDate.label}
                    <small className="block text-muted">
                      {formatDate(keyDate.date)}
                    </small>
                  </span>
                  {daysUntil(keyDate.date) < 0 ? (
                    <span className="text-[12.5px] text-muted">Passed</span>
                  ) : (
                    <DueDate date={keyDate.date} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>Outstanding</SectionTitle>
          <ul className="flex flex-col">
            <OutstandingRow
              label="Client uploads to review"
              value={overview.toReview}
              href={`/matters/${matterId}?tab=requests`}
            />
            <OutstandingRow
              label="Documents the client still owes"
              value={overview.awaitingClient}
              href={`/matters/${matterId}?tab=requests`}
            />
            <OutstandingRow
              label="Signatures in progress"
              value={overview.signaturesInProgress}
              href={`/matters/${matterId}?tab=signatures`}
            />
            <OutstandingRow
              label="Open tasks"
              value={overview.openTasks}
              href={`/matters/${matterId}?tab=tasks`}
            />
          </ul>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <SectionTitle>Client</SectionTitle>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
            <dt className="text-muted">Name</dt>
            <dd className="min-w-0 font-semibold">{matter.client.name}</dd>
            {matter.client.contactName ? (
              <>
                <dt className="text-muted">Contact</dt>
                <dd className="min-w-0">{matter.client.contactName}</dd>
              </>
            ) : null}
            <dt className="text-muted">Type</dt>
            <dd className="min-w-0">
              {matter.client.type === "COMPANY" ? "Company" : "Individual"}
            </dd>
            <dt className="text-muted">Email</dt>
            <dd className="min-w-0 font-mono text-[13px] break-words">
              {matter.client.email}
            </dd>
            {matter.client.phone ? (
              <>
                <dt className="text-muted">Phone</dt>
                <dd className="min-w-0 font-mono text-[13px]">
                  {matter.client.phone}
                </dd>
              </>
            ) : null}
          </dl>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <SectionTitle>Latest activity</SectionTitle>
            <Link
              href={`/matters/${matterId}?tab=activity`}
              className="font-medium text-accent underline underline-offset-[3px]"
            >
              View all
            </Link>
          </div>
          <Timeline
            entries={overview.activity.map((event) => ({
              id: event.id,
              type: event.type,
              summary: event.summary,
              actorName: event.actorName,
              createdAt: event.createdAt,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
