"use client";

import { useOptimistic, useTransition } from "react";

import { toggleTask } from "@/app/actions/matters";
import { cn } from "@/lib/cn";

/**
 * Ticking a task should feel instant. The optimistic state flips straight away
 * and the server action reconciles it, so the list never waits on a round trip.
 */
export function TaskCheckbox({
  taskId,
  title,
  done,
  disabled,
  meta,
}: {
  taskId: string;
  title: string;
  done: boolean;
  disabled?: boolean;
  meta: React.ReactNode;
}) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();

  return (
    <label
      className={cn(
        "flex min-w-0 flex-1 cursor-pointer items-start gap-3",
        disabled && "cursor-not-allowed",
      )}
    >
      <input
        type="checkbox"
        checked={optimisticDone}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.checked;
          startTransition(async () => {
            setOptimisticDone(next);
            await toggleTask(taskId, next);
          });
        }}
        className="mt-0.5 size-[18px] shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1">
        <span className={cn(optimisticDone && "text-muted line-through")}>
          {title}
        </span>
        <small className="block text-muted">
          {optimisticDone ? "Done" : meta}
        </small>
      </span>
    </label>
  );
}
