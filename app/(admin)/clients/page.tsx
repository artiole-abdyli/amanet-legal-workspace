import Link from "next/link";
import { Suspense } from "react";

import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { ClientFilters } from "@/components/clients/client-filters";
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  getClientWaitingCounts,
  getClients,
  type ClientFilters as Filters,
} from "@/lib/queries";

export const metadata = { title: "Clients" };

async function ClientsTable({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const query = one(params.q)?.trim() || undefined;
  const type = one(params.type) as Filters["type"];

  const [clients, waiting] = await Promise.all([
    getClients({ query, type }),
    getClientWaitingCounts(),
  ]);

  if (clients.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="users"
          title={
            query || type
              ? "No clients match these filters"
              : "No clients yet"
          }
          description={
            query || type
              ? "Try a different search, or clear the filters to see everyone."
              : "Add the client first, then open a matter for them."
          }
          action={
            query || type ? (
              <Link href="/clients" className={buttonClasses("default", "sm")}>
                Clear filters
              </Link>
            ) : (
              <Link
                href="/clients/new"
                className={buttonClasses("primary", "sm")}
              >
                <Icon name="plus" />
                New client
              </Link>
            )
          }
        />
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="bg-surface-2 text-left">
            {["Client", "Type", "Email", "Matters", "Waiting on client"].map(
              (heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="border-b border-line px-4 py-2.5 font-sans text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase"
                >
                  {heading}
                </th>
              ),
            )}
            <th className="border-b border-line px-4 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            const outstanding = waiting.get(client.id) ?? 0;
            return (
              <tr
                key={client.id}
                className="border-b border-line last:border-b-0 hover:bg-bg"
              >
                <td className="px-4 py-3.5 align-middle">
                  <b className="font-sans font-semibold">{client.name}</b>
                  {client.contactName ? (
                    <small className="block text-muted">
                      Contact: {client.contactName}
                    </small>
                  ) : null}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  {client.type === "COMPANY" ? "Company" : "Individual"}
                </td>
                <td className="px-4 py-3.5 align-middle font-mono text-[13px]">
                  {client.email}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <div className="flex flex-wrap gap-1.5">
                    {client.matters.length === 0 ? (
                      <span className="text-muted">No matters yet</span>
                    ) : (
                      client.matters.map((matter) => (
                        <Link
                          key={matter.id}
                          href={`/matters/${matter.id}`}
                          className="rounded-md bg-surface-2 px-2 py-0.5 text-xs whitespace-nowrap text-muted hover:text-fg"
                        >
                          {matter.reference}
                          {matter.archivedAt ? " (archived)" : ""}
                        </Link>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 align-middle">
                  {outstanding > 0 ? (
                    <Badge tone="warn">
                      {outstanding} item{outstanding === 1 ? "" : "s"}
                    </Badge>
                  ) : (
                    <span className="text-muted">Nothing</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right align-middle">
                  <Link
                    href={`/clients/${client.id}`}
                    className={buttonClasses("ghost", "sm")}
                    aria-label={`Edit ${client.name}`}
                  >
                    <Icon name="pen" className="size-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <>
      <PageHeader
        title="Clients"
        description="Client records. Clients have no accounts; they act through secure links."
        actions={
          <Link href="/clients/new" className={buttonClasses("primary")}>
            <Icon name="plus" />
            New client
          </Link>
        }
      />

      <Suspense fallback={<div className="h-10" />}>
        <ClientFilters />
      </Suspense>

      <Suspense fallback={<SkeletonTable rows={4} />}>
        <ClientsTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}
