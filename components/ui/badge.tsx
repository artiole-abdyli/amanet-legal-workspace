import { cn } from "@/lib/cn";

export type Tone = "ok" | "info" | "warn" | "danger" | "neutral";

const TONES: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok",
  info: "bg-info-bg text-info",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-neutral-bg text-neutral",
};

/**
 * State is carried by a dot and a word, never by colour alone, so the badge
 * still reads for anyone who cannot separate the hues.
 */
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export const matterStatusTone: Record<string, Tone> = {
  ACTIVE: "ok",
  ON_HOLD: "warn",
  CLOSED: "neutral",
};

export const requestStatusTone: Record<string, Tone> = {
  PENDING: "neutral",
  SUBMITTED: "info",
  CHANGES_REQUESTED: "warn",
  ACCEPTED: "ok",
};

export const signatureStatusTone: Record<string, Tone> = {
  SENT: "info",
  VIEWED: "info",
  STARTED: "warn",
  SIGNED: "ok",
  REVOKED: "danger",
  EXPIRED: "neutral",
};
