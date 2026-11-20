"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";

/**
 * Search and type filter for the clients list.
 *
 * Both live in the URL, so a filtered view can be bookmarked or sent to a
 * colleague. The text box is debounced; the select applies at once.
 */
export function ClientFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const firstRender = useRef(true);

  function apply(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-muted focus-within:border-muted sm:max-w-[360px]">
        <Icon name="search" />
        <span className="sr-only">Search clients</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email"
          className="w-full min-w-0 bg-transparent py-2 text-fg outline-none"
        />
      </label>

      <label>
        <span className="sr-only">Client type</span>
        <select
          className="rounded-lg border border-line bg-surface px-2.5 py-2 text-fg"
          defaultValue={searchParams.get("type") ?? ""}
          onChange={(event) => apply({ type: event.target.value || null })}
        >
          <option value="">All types</option>
          <option value="INDIVIDUAL">Individuals</option>
          <option value="COMPANY">Companies</option>
        </select>
      </label>
    </div>
  );
}
