import Link from "next/link";

import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-neutral-bg text-neutral">
        <Icon name="search" className="size-6" />
      </span>

      <h1 className="font-serif text-[26px] font-semibold">Page not found</h1>

      <p className="max-w-[52ch] text-muted">
        This page does not exist, or the matter it belonged to has been removed.
      </p>

      <Link href="/" className={buttonClasses("primary")}>
        Back to the dashboard
      </Link>
    </div>
  );
}
