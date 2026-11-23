import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

type SignatureStatus =
  | "SENT"
  | "VIEWED"
  | "STARTED"
  | "SIGNED"
  | "REVOKED"
  | "EXPIRED";

/**
 * The four states the brief asks to be visible at a glance. The bar is filled
 * for what has happened, half-filled for what is being waited on, and red where
 * the request was stopped, so the current position reads without the labels.
 */
export function SignatureStepper({
  status,
  sentAt,
  viewedAt,
  startedAt,
  signedAt,
  revokedAt,
  expiresAt,
}: {
  status: SignatureStatus;
  sentAt: Date;
  viewedAt: Date | null;
  startedAt: Date | null;
  signedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}) {
  const steps = [
    { label: "Sent", at: sentAt as Date | null },
    { label: "Viewed", at: viewedAt },
    { label: "Started", at: startedAt },
    { label: "Signed", at: signedAt },
  ];

  const reached = steps.filter((step) => step.at).length;
  const stopped = status === "REVOKED" || status === "EXPIRED";
  const waiting = status === "SENT" || status === "VIEWED" || status === "STARTED";

  return (
    <ol className="grid grid-cols-2 gap-x-2 gap-y-3.5 sm:grid-cols-4">
      {steps.map((step, index) => {
        const done = Boolean(step.at);
        const isStop = stopped && index === reached;
        const isNow = waiting && index === reached;

        return (
          <li key={step.label} className="flex flex-col gap-1.5 text-[13px]">
            <span
              className={cn(
                "h-1 rounded-sm",
                done && "bg-accent",
                isStop && "bg-danger",
                !done && !isStop && !isNow && "bg-line",
              )}
              style={
                isNow
                  ? {
                      background:
                        "linear-gradient(90deg, var(--accent) 50%, var(--line) 50%)",
                    }
                  : undefined
              }
            />
            <b
              className={cn(
                "flex items-center gap-1.5 font-semibold",
                !done && !isNow && !isStop && "font-medium text-faint",
              )}
            >
              {done ? <Icon name="check" className="size-3.5" /> : null}
              {isStop ? (status === "EXPIRED" ? "Expired" : "Revoked") : step.label}
            </b>
            <small className="text-xs text-muted">
              {step.at
                ? formatDateTime(step.at)
                : isStop
                  ? formatDateTime(status === "EXPIRED" ? expiresAt : revokedAt)
                  : isNow
                    ? "Waiting"
                    : "—"}
            </small>
          </li>
        );
      })}
    </ol>
  );
}
