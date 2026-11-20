import { calendarParts, dueLabel, priorityLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Priority as three rising bars. A glanceable shape beats a coloured word when
 * the eye is scanning a column of rows.
 */
export function PriorityMeter({
  priority,
}: {
  priority: "LOW" | "MEDIUM" | "HIGH";
}) {
  const filled = priority === "HIGH" ? 3 : priority === "MEDIUM" ? 2 : 1;
  const colour =
    priority === "HIGH"
      ? "bg-danger"
      : priority === "MEDIUM"
        ? "bg-warn"
        : "bg-neutral";

  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap text-muted">
      <span aria-hidden="true" className="inline-flex items-end gap-0.5">
        {[5, 8, 12].map((height, index) => (
          <i
            key={height}
            style={{ height }}
            className={cn(
              "w-[3px] rounded-[1px]",
              index < filled ? colour : "bg-line-strong",
            )}
          />
        ))}
      </span>
      {priorityLabel[priority]} priority
    </span>
  );
}

export function DueDate({
  date,
  prefix,
  className,
}: {
  date: Date;
  prefix?: string;
  className?: string;
}) {
  const { text, tone } = dueLabel(date);
  return (
    <span
      className={cn(
        "text-[12.5px] whitespace-nowrap",
        tone === "late" && "font-semibold text-danger",
        tone === "soon" && "font-medium text-warn",
        tone === "normal" && "text-muted",
        className,
      )}
    >
      {prefix ? `${prefix}: ` : null}
      {text}
    </span>
  );
}

/** The torn-off calendar page used beside key dates. */
export function CalendarTile({ date }: { date: Date }) {
  const { month, day } = calendarParts(date);
  return (
    <span className="w-[46px] shrink-0 overflow-hidden rounded-lg border border-line bg-surface text-center">
      <span className="block bg-surface-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">
        {month}
      </span>
      <span className="block py-0.5 pb-1 font-serif text-[19px] font-semibold tabular">
        {day}
      </span>
    </span>
  );
}

export function VersionTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[5px] border border-line px-1.5 py-px font-mono text-[11.5px] whitespace-nowrap text-muted">
      {children}
    </span>
  );
}

export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-md bg-surface-2 px-2 py-0.5 text-xs whitespace-nowrap text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
