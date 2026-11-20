"use client";

import { useTransition } from "react";

import { setMatterStatus } from "@/app/actions/matters";
import type { MatterStatus } from "@/app/generated/prisma/client";
import { cn } from "@/lib/cn";

export function StatusSelect({
  matterId,
  status,
  disabled,
}: {
  matterId: string;
  status: MatterStatus;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-muted">
      Status
      <select
        defaultValue={status}
        disabled={disabled || pending}
        aria-busy={pending}
        onChange={(event) =>
          startTransition(async () => {
            await setMatterStatus(matterId, event.target.value as MatterStatus);
          })
        }
        className={cn(
          "rounded-lg border border-line bg-surface px-2.5 py-2 text-fg",
          pending && "opacity-60",
        )}
      >
        <option value="ACTIVE">Active</option>
        <option value="ON_HOLD">On hold</option>
        <option value="CLOSED">Closed</option>
      </select>
    </label>
  );
}
