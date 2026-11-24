"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/actions/auth";
import { FirmMark, Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/matters", label: "Matters", icon: "folder" },
  { href: "/clients", label: "Clients", icon: "users" },
  { href: "/emails", label: "Email", icon: "mail" },
  { href: "/activity", label: "Activity", icon: "clock" },
];

type ShellProps = {
  firmName: string;
  userName: string;
  userRole: string;
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Brand({ firmName }: { firmName: string }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 px-1.5 text-fg">
      <FirmMark />
      <span>
        <b className="block font-serif text-[17px] leading-tight font-semibold">
          {firmName}
        </b>
        <small className="text-xs text-muted">Matter workspace</small>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function UserFooter({ userName, userRole }: Omit<ShellProps, "firmName">) {
  return (
    <div className="mt-auto flex items-center gap-2.5 border-t border-line px-1.5 pt-2.5">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted"
      >
        {initials(userName)}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[13px] font-semibold">{userName}</b>
        <small className="block truncate text-xs text-muted">{userRole}</small>
      </span>
      <form action={signOut}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Icon name="logout" className="size-4" />
        </button>
      </form>
    </div>
  );
}

/** The permanent sidebar, from the `lg` breakpoint up. */
export function Sidebar({ firmName, userName, userRole }: ShellProps) {
  return (
    <aside className="sticky top-0 z-20 hidden h-screen flex-col gap-6 self-start border-r border-line bg-surface px-3.5 py-5 lg:flex">
      <Brand firmName={firmName} />
      <NavLinks />
      <UserFooter userName={userName} userRole={userRole} />
    </aside>
  );
}

/**
 * Below `lg` the sidebar becomes a drawer behind a menu button at the right
 * end of the top bar, where a thumb reaches it, so the bar stays one row on a
 * phone. The drawer slides in from the same side.
 *
 * It behaves as a modal dialog: Escape, the close button, a tap on the
 * backdrop or choosing a page closes it; the page behind does not scroll
 * while it is open; focus moves into it and returns to the button after.
 */
export function MobileNav({ firmName, userName, userRole }: ShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // A navigation that did not come from the drawer (back button, a link in
  // the page) still closes it.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) buttonRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The panel is still becoming visible in this frame; focus it in the next.
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      (
        panel?.querySelector<HTMLElement>('[aria-current="page"]') ??
        panel?.querySelector<HTMLElement>("a, button")
      )?.focus();
    });

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      // Keep Tab inside the drawer while it is open.
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>("a, button");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="shrink-0 lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen(true)}
        className="grid size-9 cursor-pointer place-items-center rounded-lg text-fg hover:bg-surface-2"
      >
        <Icon name="menu" />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-50 overflow-hidden",
          // Visible at once when opening, so focus can land inside; hidden
          // only after the slide-out has played when closing.
          open
            ? "visible [transition:visibility_0s]"
            : "invisible [transition:visibility_0s_linear_200ms]",
        )}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-[rgb(10_18_32/0.45)] transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          id="mobile-nav"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          inert={!open}
          className={cn(
            "absolute inset-y-0 right-0 flex w-[min(280px,85vw)] flex-col gap-6 bg-surface px-3.5 py-4 shadow-card transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <Brand firmName={firmName} />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
            >
              <Icon name="x" />
            </button>
          </div>
          <NavLinks onNavigate={() => setOpen(false)} />
          <UserFooter userName={userName} userRole={userRole} />
        </div>
      </div>
    </div>
  );
}
