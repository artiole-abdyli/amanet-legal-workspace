"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";

/**
 * Filters live in the URL, so a filtered view can be bookmarked, shared with a
 * colleague, and survives a reload. The text box is debounced; the selects
 * apply immediately.
 */
export function MatterFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const firstRender = useRef(true);

  function apply(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    // A narrower list has fewer pages, so page 7 of the old result is
    // meaningless against the new one.
    params.delete("page");
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
    "rounded-lg border border-line bg-surface px-2.5 py-2 text-fg";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-muted focus-within:border-muted sm:max-w-[360px]">
        <Icon name="search" />
        <span className="sr-only">Search matters</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, reference, client or document"
          className="w-full min-w-0 bg-transparent py-2 text-fg outline-none"
        />
      </label>

      <label>
        <span className="sr-only">Status</span>
        <select
          className={selectClass}
          defaultValue={searchParams.get("status") ?? ""}
          onChange={(event) => apply({ status: event.target.value || null })}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On hold</option>
          <option value="CLOSED">Closed</option>
        </select>
      </label>

      <label>
        <span className="sr-only">Priority</span>
        <select
          className={selectClass}
          defaultValue={searchParams.get("priority") ?? ""}
          onChange={(event) => apply({ priority: event.target.value || null })}
        >
          <option value="">All priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </label>

      <label>
        <span className="sr-only">Sort</span>
        <select
          className={selectClass}
          defaultValue={searchParams.get("sort") ?? "deadline"}
          onChange={(event) => apply({ sort: event.target.value })}
        >
          <option value="deadline">Sort: next key date</option>
          <option value="priority">Sort: priority</option>
          <option value="opened">Sort: recently opened</option>
        </select>
      </label>

      <label className="inline-flex cursor-pointer items-center gap-2 text-muted">
        <input
          type="checkbox"
          className="size-4 accent-[var(--accent)]"
          defaultChecked={searchParams.get("archived") === "1"}
          onChange={(event) =>
            apply({ archived: event.target.checked ? "1" : null })
          }
        />
        Show archived
      </label>
    </div>
  );
}
