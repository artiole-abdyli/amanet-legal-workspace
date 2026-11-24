"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";

const KINDS: [string, string][] = [
  ["sign", "Signature requests"],
  ["reminder", "Reminders"],
  ["upload", "Document requests"],
  ["correction", "New copy needed"],
  ["signed", "Signed copies"],
];

/**
 * Search and filters for the outbox, kept in the URL like the matters list so
 * a filtered view survives a reload and can be shared. Changing a filter
 * closes the open message, which may no longer be in the list.
 */
export function EmailFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const firstRender = useRef(true);

  function apply(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("id");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => apply({ q: query || null }), 250);
    return () => clearTimeout(timer);
    // `apply` closes over the current params on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selectClass =
    "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-fg";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-muted focus-within:border-muted sm:max-w-[340px]">
        <Icon name="search" className="size-4" />
        <span className="sr-only">Search email</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by recipient or subject"
          className="w-full min-w-0 bg-transparent py-1.5 text-fg outline-none"
        />
      </label>

      <label>
        <span className="sr-only">Type</span>
        <select
          className={selectClass}
          defaultValue={searchParams.get("kind") ?? ""}
          onChange={(event) => apply({ kind: event.target.value || null })}
        >
          <option value="">All types</option>
          {KINDS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="sr-only">Status</span>
        <select
          className={selectClass}
          defaultValue={searchParams.get("status") ?? ""}
          onChange={(event) => apply({ status: event.target.value || null })}
        >
          <option value="">All statuses</option>
          <option value="SENT">Sent</option>
          <option value="QUEUED">Queued</option>
          <option value="FAILED">Failed</option>
        </select>
      </label>
    </div>
  );
}
