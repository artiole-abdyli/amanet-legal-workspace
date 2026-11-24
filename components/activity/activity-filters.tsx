"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";

/**
 * Search and filters for the firm's activity log. Kept in the URL like every
 * other list, so a filtered view survives a reload and can be shared.
 */
export function ActivityFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function apply(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  // Runs only when the typed text differs from what the URL already says.
  // Comparing values rather than skipping the first run matters: React runs
  // effects twice in development, and a skipped-once guard then fired a
  // search that dropped `page` from a URL opened directly at page 3.
  useEffect(() => {
    if (query === (searchParams.get("q") ?? "")) return;
    const timer = setTimeout(() => apply({ q: query || null }), 250);
    return () => clearTimeout(timer);
    // `apply` closes over the current params on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selectClass =
    "rounded-lg border border-line bg-surface px-2.5 py-2 text-fg";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="flex min-w-0 flex-1 basis-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-muted focus-within:border-muted sm:max-w-[360px] sm:basis-auto">
        <Icon name="search" />
        <span className="sr-only">Search activity</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by event, person or matter"
          className="w-full min-w-0 bg-transparent py-2 text-fg outline-none"
        />
      </label>

      <label>
        <span className="sr-only">Type</span>
        <select
          className={selectClass}
          defaultValue={searchParams.get("type") ?? ""}
          onChange={(event) => apply({ type: event.target.value || null })}
        >
          <option value="">All events</option>
          <option value="DOCUMENT">Documents</option>
          <option value="REQUEST">Client requests</option>
          <option value="SIGNATURE">Signatures</option>
          <option value="TASK">Tasks</option>
          <option value="NOTE">Notes</option>
          <option value="MATTER">Matter changes</option>
        </select>
      </label>

      <label>
        <span className="sr-only">Done by</span>
        <select
          className={selectClass}
          defaultValue={searchParams.get("actor") ?? ""}
          onChange={(event) => apply({ actor: event.target.value || null })}
        >
          <option value="">Anyone</option>
          <option value="ADMIN">The firm</option>
          <option value="CLIENT">Clients</option>
          <option value="SYSTEM">Automatic</option>
        </select>
      </label>
    </div>
  );
}
