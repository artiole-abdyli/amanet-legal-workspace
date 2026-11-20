"use client";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

/**
 * What a visitor sees when something fails underneath: the database is
 * unreachable, a query throws, a file is missing. It says what happened in
 * plain words and offers the one useful action, rather than showing a stack
 * trace to someone who cannot act on it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-danger-bg text-danger">
        <Icon name="alert" className="size-6" />
      </span>

      <h1 className="font-serif text-[26px] font-semibold">
        Something went wrong
      </h1>

      <p className="max-w-[52ch] text-muted">
        The workspace could not finish loading this page. Nothing you were
        working on has been lost.
      </p>

      <Button variant="primary" onClick={reset}>
        Try again
      </Button>

      {error.digest ? (
        <p className="text-[12.5px] text-muted">
          Reference for the error log:{" "}
          <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
