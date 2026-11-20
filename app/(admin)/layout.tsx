import Link from "next/link";
import { Suspense } from "react";
import type { ReactNode } from "react";

import { FirmMark, Icon } from "@/components/icons";
import { NotificationsBell } from "@/components/shell/notifications";
import { SearchDialog } from "@/components/shell/search-dialog";
import { Sidebar } from "@/components/shell/sidebar";
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

async function SidebarData() {
  const user = await requireAdmin();
  const firm = await getFirm();
  return (
    <Sidebar
      firmName={firm.name.replace(/ LLP$/, "")}
      userName={user.name}
      userRole={user.role === "ADMIN" ? "Admin" : user.role}
    />
  );
}

function SidebarFallback() {
  return (
    <aside className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 lg:h-screen lg:flex-col lg:items-stretch lg:gap-6 lg:self-start lg:border-r lg:border-b-0 lg:px-3.5 lg:py-5">
      <div className="flex items-center gap-2.5 lg:px-1.5">
        <FirmMark />
        <Skeleton className="hidden h-7 w-32 lg:block" />
      </div>
      <div className="flex gap-2 lg:flex-col">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
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
        <Link href="/matters/new" className={buttonClasses("primary")}>
          <Icon name="plus" />
          <span className="hidden sm:inline">New matter</span>
        </Link>
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
        <Skeleton className="h-9 w-32 rounded-lg" />
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
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 lg:px-7 lg:py-3.5">
          <Suspense fallback={<TopBarFallback />}>
            <TopBarData />
          </Suspense>
        </header>

        <main className="flex w-full max-w-[1240px] flex-col gap-6 px-4 py-6 lg:px-7 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
