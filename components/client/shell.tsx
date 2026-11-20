import type { ReactNode } from "react";

import { FirmMark, Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * The chrome a client sees. Deliberately plain and mobile-first: most people
 * open these links on a phone, from an email, and will never see any other part
 * of the application.
 */
export function ClientShell({
  firmName,
  mode,
  children,
}: {
  firmName: string;
  mode: "Secure signing" | "Secure upload";
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface px-4 py-3.5">
        <div className="mx-auto flex max-w-[760px] items-center gap-3">
          <FirmMark />
          <div>
            <b className="block font-serif text-base font-semibold">
              {firmName}
            </b>
            <small className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ok">
              <Icon name="lock" className="size-3.5" />
              {mode}
            </small>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-6 px-4 py-8">
        {children}
      </main>

      <footer className="mx-auto max-w-[640px] px-4 pt-5 pb-8 text-center text-[12.5px] text-muted">
        This page was sent to you by {firmName}. The link works only for the
        person it was sent to, so please do not forward it.
      </footer>
    </div>
  );
}

/** The full-page outcomes: expired, revoked, already done, thank you. */
export function ClientState({
  tone,
  icon,
  title,
  children,
  extra,
}: {
  tone: "ok" | "bad" | "neutral";
  icon: "check" | "ban" | "clock" | "lock";
  title: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-10 text-center">
      <span
        className={cn(
          "grid size-14 place-items-center rounded-full",
          tone === "ok" && "bg-ok-bg text-ok",
          tone === "bad" && "bg-danger-bg text-danger",
          tone === "neutral" && "bg-neutral-bg text-neutral",
        )}
      >
        <Icon name={icon} className="size-6" />
      </span>
      <h1 className="font-serif text-[26px] font-semibold">{title}</h1>
      <div className="max-w-[52ch] text-muted">{children}</div>
      {extra}
    </section>
  );
}

export function ClientIntro({
  eyebrow,
  title,
  children,
  meta,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold tracking-[0.08em] text-accent uppercase">
        {eyebrow}
      </p>
      <h1 className="font-serif text-[30px] leading-tight font-semibold tracking-[-0.015em]">
        {title}
      </h1>
      {children ? (
        <p className="max-w-[62ch] text-[15px] text-muted">{children}</p>
      ) : null}
      {meta ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

export function MetaItem({
  icon,
  children,
}: {
  icon: "file" | "clock" | "shield";
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name={icon} className="size-[15px]" />
      {children}
    </span>
  );
}
