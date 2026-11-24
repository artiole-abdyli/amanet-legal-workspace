"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

export type NotificationItem = {
  id: string;
  text: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openNotification(item: NotificationItem) {
    setOpen(false);
    startTransition(async () => {
      await markNotificationRead(item.id);
      if (item.href) router.push(item.href);
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <IconButton
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="size-9"
      >
        <Icon name="bell" className="size-[22px]" />
        {/* Sits on the button's corner, clear of the bell, so neither hides
            the other; a large count is capped so the badge keeps its size. */}
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10.5px] leading-none font-semibold text-white tabular ring-2 ring-surface"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </IconButton>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute top-11 right-0 z-40 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-surface shadow-card"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <b className="font-sans font-semibold">Notifications</b>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await markAllNotificationsRead();
                  })
                }
                className="cursor-pointer font-medium text-accent underline underline-offset-[3px]"
              >
                Mark all as read
              </button>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted">
              Nothing yet. Client uploads and signature activity show up here.
            </p>
          ) : (
            <ul className="max-h-[380px] overflow-auto">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(item)}
                    className="flex w-full cursor-pointer gap-2.5 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-bg"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        item.readAt ? "bg-transparent" : "bg-accent",
                      )}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block",
                          item.readAt ? "text-muted" : "font-medium",
                        )}
                      >
                        {item.text}
                      </span>
                      <small className="block text-xs text-muted">
                        {formatDateTime(item.createdAt)}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
