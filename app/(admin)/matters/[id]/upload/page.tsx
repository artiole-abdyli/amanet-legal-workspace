import Link from "next/link";
import { Suspense } from "react";

import { uploadMatterDocument } from "@/app/actions/documents";
import { Icon } from "@/components/icons";
import { Button, buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import {
  Field,
  FormActions,
  FormCard,
  FormPage,
  Input,
} from "@/components/ui/form";
import { SkeletonCard } from "@/components/ui/skeleton";

export const metadata = { title: "Upload a document" };

type Params = Promise<{ id: string }>;

async function UploadDocument({ params }: { params: Params }) {
  const { id } = await params;

  return (
    <FormPage
      backHref={`/matters/${id}?tab=documents`}
      backLabel="Back to matter"
      title="Upload a document"
      description="PDFs only, up to 20 MB."
    >
      <form action={uploadMatterDocument.bind(null, id)}>
        <FormCard>
          <Field label="PDF file">
            <Input
              type="file"
              name="file"
              required
              accept="application/pdf,.pdf"
              className="file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:font-medium"
            />
          </Field>

          <Callout>
            Uploading a file whose name already exists in this matter adds the
            next version. The earlier version stays in the document history, and
            anything already sent for signature keeps pointing at the version it
            was sent with.
          </Callout>

          <FormActions>
            <Link
              href={`/matters/${id}?tab=documents`}
              className={buttonClasses()}
            >
              Cancel
            </Link>
            <Button type="submit" variant="primary">
              <Icon name="upload" />
              Upload
            </Button>
          </FormActions>
        </FormCard>
      </form>
    </FormPage>
  );
}

export default function UploadDocumentPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<SkeletonCard rows={3} />}>
      <UploadDocument params={params} />
    </Suspense>
  );
}
