import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { createDocumentRequest } from "@/app/actions/requests";
import { Icon } from "@/components/icons";
import { Button, buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import {
  Field,
  FormActions,
  FormCard,
  FormPage,
  Input,
  Textarea,
} from "@/components/ui/form";
import { SkeletonCard } from "@/components/ui/skeleton";
import { getMatter } from "@/lib/queries";

export const metadata = { title: "Request documents" };

type Params = Promise<{ id: string }>;
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

function inAWeek() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

async function RequestDocuments({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const showError = (await searchParams).error === "title";
  const matter = await getMatter(id);
  if (!matter) notFound();

  const recipient = matter.client.contactName ?? matter.client.name;

  return (
    <FormPage
      backHref={`/matters/${id}?tab=requests`}
      backLabel="Back to matter"
      title="Request documents"
      description="The client uploads through a secure link. They never need an account."
    >
      <form action={createDocumentRequest.bind(null, id)}>
        <FormCard>
          {showError ? (
            <div role="alert">
              <Callout tone="warn">Say which document you need.</Callout>
            </div>
          ) : null}

          <Field label="What do you need?">
            <Input name="title" required placeholder="e.g. Proof of address" />
          </Field>

          <Field
            label="Details for the client"
            hint="Say exactly what counts, so they get it right the first time."
          >
            <Textarea
              name="description"
              rows={3}
              placeholder="A utility bill or council tax letter dated within the last three months."
            />
          </Field>

          <Field label="Needed by">
            <Input type="date" name="dueDate" defaultValue={inAWeek()} />
          </Field>

          <Callout>
            {recipient} receives an email at{" "}
            <span className="font-mono text-[13px]">{matter.client.email}</span>{" "}
            with a secure upload link. Files land in this matter&rsquo;s Client
            uploads folder.
          </Callout>

          <FormActions>
            <Link
              href={`/matters/${id}?tab=requests`}
              className={buttonClasses()}
            >
              Cancel
            </Link>
            <Button type="submit" variant="primary">
              <Icon name="send" />
              Send request
            </Button>
          </FormActions>
        </FormCard>
      </form>
    </FormPage>
  );
}

export default function RequestDocumentsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  return (
    <Suspense fallback={<SkeletonCard rows={4} />}>
      <RequestDocuments params={params} searchParams={searchParams} />
    </Suspense>
  );
}
