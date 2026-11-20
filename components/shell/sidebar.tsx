"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { FirmMark, Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/matters", label: "Matters", icon: "folder" },
  { href: "/clients", label: "Clients", icon: "users" },
];

export function Sidebar({
  firmName,
  userName,
  userRole,
}: {
  firmName: string;
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-20 flex gap-3 overflow-x-auto border-b border-line bg-surface px-4 py-2.5 lg:h-screen lg:flex-col lg:gap-6 lg:self-start lg:overflow-visible lg:border-r lg:border-b-0 lg:px-3.5 lg:py-5">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2.5 text-fg lg:px-1.5"
      >
        <FirmMark />
        <span className="hidden lg:block">
          <b className="block font-serif text-[17px] leading-tight font-semibold">
            {firmName}
          </b>
          <small className="text-xs text-muted">Matter workspace</small>
        </span>
      </Link>

      <nav aria-label="Main" className="flex gap-0.5 lg:flex-col">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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

      <div className="mt-auto hidden items-center gap-2.5 border-t border-line px-1.5 pt-2.5 lg:flex">
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
    </aside>
  );
}
