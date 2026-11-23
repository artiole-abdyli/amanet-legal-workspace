import { notFound } from "next/navigation";
import { Suspense } from "react";

import { addKeyDate, deleteKeyDate } from "@/app/actions/matters";
import { Icon } from "@/components/icons";
import { EditMatterForm } from "@/components/matters/edit-matter-form";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { FormPage } from "@/components/ui/form";
import { CalendarTile } from "@/components/ui/meta";
import { SkeletonCard } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { getMatter } from "@/lib/queries";

export const metadata = { title: "Edit matter" };

type Params = Promise<{ id: string }>;

/** An <input type="date"> wants yyyy-mm-dd, in local time, not an ISO string. */
function dateInputValue(date: Date | null): string {
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function EditMatter({ params }: { params: Params }) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) notFound();

  return (
    <FormPage
      backHref={`/matters/${id}`}
      backLabel="Back to matter"
      title="Edit matter"
      description={`${matter.reference} · ${matter.client.name}`}
    >
      <EditMatterForm
        matterId={matter.id}
        title={matter.title}
        practiceArea={matter.practiceArea}
        priority={matter.priority}
        status={matter.status}
        deadline={dateInputValue(matter.deadline)}
      />

      <Card>
        <SectionTitle>Key dates</SectionTitle>

        {matter.keyDates.length === 0 ? (
          <p className="text-muted">
            No key dates yet. These are the dates the dashboard counts down to.
          </p>
        ) : (
          <ul className="flex flex-col">
            {matter.keyDates.map((keyDate) => (
              <li
                key={keyDate.id}
                className="flex items-center gap-3.5 border-t border-line py-2.5 first:border-t-0 first:pt-0"
              >
                <CalendarTile date={keyDate.date} />
                <span className="min-w-0 flex-1">
                  {keyDate.label}
                  <small className="block text-muted">
                    {formatDate(keyDate.date)}
                  </small>
                </span>
                <form action={deleteKeyDate.bind(null, keyDate.id)}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${keyDate.label}`}
                  >
                    <Icon name="x" className="size-4" />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addKeyDate.bind(null, matter.id)}
          className="flex flex-wrap items-end gap-2.5 border-t border-line pt-4"
        >
          <Field label="New key date" className="min-w-0 flex-1 basis-[200px]">
            <Input
              name="label"
              required
              placeholder="e.g. Exchange of contracts"
            />
          </Field>
          <Field label="On">
            <Input type="date" name="date" required />
          </Field>
          <Button type="submit">
            <Icon name="plus" />
            Add
          </Button>
        </form>
      </Card>
    </FormPage>
  );
}

export default function EditMatterPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<SkeletonCard rows={5} />}>
      <EditMatter params={params} />
    </Suspense>
  );
}
