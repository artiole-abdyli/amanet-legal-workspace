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
  ValidatedForm,
} from "@/components/ui/form";
import { SkeletonCard } from "@/components/ui/skeleton";

export const metadata = { title: "Upload a document" };

type Params = Promise<{ id: string }>;
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

const ERRORS: Record<string, string> = {
  missing: "Choose a PDF file to upload.",
  "too-large": "That file is larger than 20 MB. Upload a smaller PDF.",
  "not-pdf": "That file is not a PDF. Only PDF documents can be uploaded.",
};

async function UploadDocument({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const raw = (await searchParams).error;
  const error = ERRORS[Array.isArray(raw) ? raw[0] : (raw ?? "")];

  return (
    <FormPage
      backHref={`/matters/${id}?tab=documents`}
      backLabel="Back to matter"
      title="Upload a document"
      description="PDFs only, up to 20 MB."
    >
      <ValidatedForm action={uploadMatterDocument.bind(null, id)}>
        <FormCard>
          {error ? (
            <div role="alert">
              <Callout tone="warn">{error}</Callout>
            </div>
          ) : null}

          <Field label="PDF file" required>
            <Input
              type="file"
              name="file"
              required
              data-msg-required="Choose the PDF to upload."
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
      </ValidatedForm>
    </FormPage>
  );
}

export default function UploadDocumentPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  return (
    <Suspense fallback={<SkeletonCard rows={3} />}>
      <UploadDocument params={params} searchParams={searchParams} />
    </Suspense>
  );
}
