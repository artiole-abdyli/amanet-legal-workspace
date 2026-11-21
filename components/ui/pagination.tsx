import Link from "next/link";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

type Params = { [key: string]: string | string[] | undefined };

/**
 * Page links for a filtered list.
 *
 * They are real links, not buttons, so a page can be bookmarked, opened in a
 * new tab, and reached without JavaScript. Every current filter is carried
 * across, which is why the whole search string is rebuilt rather than patched.
 */
export function Pagination({
  basePath,
  params,
  page,
  pageCount,
  total,
  perPage,
  noun = "matters",
}: {
  basePath: string;
  params: Params;
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  noun?: string;
}) {
  function href(target: number) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      next.set(key, Array.isArray(value) ? value[0] : value);
    }
    if (target > 1) next.set("page", String(target));
    const query = next.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  // Up to five numbered pages, centred on where you are.
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const numbers = Array.from(
    { length: Math.min(5, pageCount) },
    (_, index) => start + index,
  );

  // "1 clients" reads badly, and "Showing 1-6 of 6" says nothing a plain count
  // does not when everything already fits on one page.
  const label = total === 1 ? noun.replace(/s$/, "") : noun;
  const summary =
    total === 0
      ? `No ${noun}`
      : pageCount === 1
        ? `${total} ${label}`
        : `Showing ${first}–${last} of ${total} ${label}`;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-muted">{summary}</p>

      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link
              href={href(page - 1)}
              rel="prev"
              aria-label="Previous page"
              className="grid size-9 place-items-center rounded-lg border border-line-strong bg-surface hover:bg-surface-2"
            >
              <Icon name="arrow" className="size-4 rotate-180" />
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-lg border border-line text-faint"
            >
              <Icon name="arrow" className="size-4 rotate-180" />
            </span>
          )}

          {numbers.map((number) => (
            <Link
              key={number}
              href={href(number)}
              aria-label={`Page ${number}`}
              aria-current={number === page ? "page" : undefined}
              className={cn(
                "grid size-9 place-items-center rounded-lg border tabular",
                number === page
                  ? "border-accent bg-accent font-semibold text-accent-fg"
                  : "border-line-strong bg-surface hover:bg-surface-2",
              )}
            >
              {number}
            </Link>
          ))}

          {page < pageCount ? (
            <Link
              href={href(page + 1)}
              rel="next"
              aria-label="Next page"
              className="grid size-9 place-items-center rounded-lg border border-line-strong bg-surface hover:bg-surface-2"
            >
              <Icon name="arrow" className="size-4" />
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-lg border border-line text-faint"
            >
              <Icon name="arrow" className="size-4" />
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
