"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

export type SearchItem = {
  id: string;
  group: "Matters" | "Clients" | "Documents";
  label: string;
  hint: string;
  href: string;
  icon: IconName;
};

/**
 * One search box for the whole workspace, opened with Ctrl/Cmd K. The brief
 * asks to find matters, client records and documents efficiently, and an Admin
 * who lives in this app all day should not have to aim at a nav item first.
 */
export function SearchDialog({ items }: { items: SearchItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function openDialog() {
    setQuery("");
    setActive(0);
    setOpen(true);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setOpen(false);
        else openDialog();
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? items.filter((item) =>
          `${item.label} ${item.hint}`.toLowerCase().includes(needle),
        )
      : items;
    return matches.slice(0, 12);
  }, [items, query]);

  function go(item: SearchItem) {
    setOpen(false);
    router.push(item.href);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openDialog}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-bg px-3 py-2 text-left text-muted transition-colors hover:border-line-strong sm:max-w-[520px]"
      >
        <Icon name="search" />
        <span className="flex-1 truncate">
          Search matters, clients, documents
        </span>
        
      </button>
    );
  }

  let lastGroup = "";

  return (
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 cursor-default bg-[rgb(10_18_32/0.45)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="fixed inset-x-4 top-[12vh] z-50 mx-auto max-w-[620px] overflow-hidden rounded-xl border border-line bg-surface shadow-card"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5 text-muted">
          <Icon name="search" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && results[active]) {
                event.preventDefault();
                go(results[active]);
              }
            }}
            
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none"
          />
        </div>

        <div className="max-h-[52vh] overflow-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-muted">
              Nothing matches “{query}”. Try a client name, a reference like
              AP-2026-0142, or a file name.
            </p>
          ) : (
            results.map((item, index) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {showGroup ? (
                    <div className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.07em] text-muted uppercase">
                      {item.group}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left",
                      index === active ? "bg-surface-2" : "hover:bg-surface-2",
                    )}
                  >
                    <Icon name={item.icon} className="text-muted" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <small className="shrink-0 font-mono text-[11.5px] text-muted">
                      {item.hint}
                    </small>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
