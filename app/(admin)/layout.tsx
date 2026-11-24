import Link from "next/link";
import { Suspense } from "react";
import type { ReactNode } from "react";

import { FirmMark, Icon } from "@/components/icons";
import { NotificationsBell } from "@/components/shell/notifications";
import { SearchDialog } from "@/components/shell/search-dialog";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth";
import {
  getFirm,
  getNotifications,
  getSearchIndex,
  getUnreadNotificationCount,
} from "@/lib/queries";

/**
 * The firm's shell. Everything inside it is per-request data, so the frame is
 * prerendered and each piece streams in behind its own boundary rather than
 * holding the whole page back.
 */

async function shellProps() {
  const user = await requireAdmin();
  const firm = await getFirm();
  return {
    firmName: firm.name.replace(/ LLP$/, ""),
    userName: user.name,
    userRole: user.role === "ADMIN" ? "Admin" : user.role,
  };
}

async function SidebarData() {
  return <Sidebar {...await shellProps()} />;
}

async function MobileNavData() {
  return <MobileNav {...await shellProps()} />;
}

function SidebarFallback() {
  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-6 self-start border-r border-line bg-surface px-3.5 py-5 lg:flex">
      <div className="flex items-center gap-2.5 px-1.5">
        <FirmMark />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </aside>
  );
}

async function TopBarData() {
  const [items, notifications, unreadCount] = await Promise.all([
    getSearchIndex(),
    getNotifications(),
    getUnreadNotificationCount(),
  ]);

  return (
    <>
      <SearchDialog items={items} />
      <div className="ml-auto flex items-center gap-2.5">
        <NotificationsBell
          notifications={notifications}
          unreadCount={unreadCount}
        />
        {/* On a phone this lives in the menu, so the bar keeps to search,
            notifications and the menu button. */}
        <div className="hidden sm:block">
          <Link href="/matters/new" className={buttonClasses("primary")}>
            <Icon name="plus" />
            New matter
          </Link>
        </div>
      </div>
    </>
  );
}

function TopBarFallback() {
  return (
    <>
      <Skeleton className="h-9 min-w-0 flex-1 sm:max-w-[520px]" />
      <div className="ml-auto flex items-center gap-2.5">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="hidden h-9 w-32 rounded-lg sm:block" />
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <Suspense fallback={<SidebarFallback />}>
        <SidebarData />
      </Suspense>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5 sm:gap-3 sm:px-4 lg:static lg:px-7 lg:py-3.5">
          <Suspense fallback={<TopBarFallback />}>
            <TopBarData />
          </Suspense>
          <Suspense
            fallback={<div aria-hidden="true" className="size-9 shrink-0 lg:hidden" />}
          >
            <MobileNavData />
          </Suspense>
        </header>

        <main className="flex w-full max-w-[1240px] flex-col gap-6 px-4 py-6 lg:px-7 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
