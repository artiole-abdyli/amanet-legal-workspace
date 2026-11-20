import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={cn(
        "flex min-w-0 flex-col gap-3.5 rounded-card border border-line bg-surface p-5",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  aside,
}: {
  title: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <SectionTitle>{title}</SectionTitle>
      {aside}
    </div>
  );
}

/** The small uppercase label that heads a panel. */
export function SectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-sans text-xs font-semibold tracking-[0.07em] text-muted uppercase",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/**
 * Every list in the workspace has one of these. An empty state names what will
 * appear here and offers the action that fills it, rather than just saying the
 * list is empty.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted">
      <Icon name={icon} className="size-7 text-faint" />
      <b className="text-[15px] font-semibold text-fg">{title}</b>
      {description ? <p className="max-w-[46ch]">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function Callout({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px]",
        tone === "warn" ? "bg-warn-bg" : "bg-info-bg",
      )}
    >
      <Icon
        name="info"
        className={cn("mt-0.5", tone === "warn" ? "text-warn" : "text-info")}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl leading-tight font-semibold tracking-[-0.015em]">
          {title}
        </h1>
        {description ? <p className="mt-1 text-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
