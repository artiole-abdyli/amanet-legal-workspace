import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { createSignatureRequest } from "@/app/actions/signatures";
import { Icon } from "@/components/icons";
import { Button, buttonClasses } from "@/components/ui/button";
import { Callout, Card, EmptyState } from "@/components/ui/card";
import {
  Field,
  FieldRow,
  FormActions,
  FormCard,
  FormPage,
  Input,
  Select,
  Textarea,
} from "@/components/ui/form";
import { SkeletonCard } from "@/components/ui/skeleton";
import { documentTitle } from "@/lib/format";
import { getMatter, getMatterDocuments } from "@/lib/queries";

export const metadata = { title: "Request a signature" };

type Params = Promise<{ id: string }>;
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

async function RequestSignature({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const raw = (await searchParams).document;
  const preselected = Array.isArray(raw) ? raw[0] : raw;

  const [matter, documents] = await Promise.all([
    getMatter(id),
    getMatterDocuments(id),
  ]);
  if (!matter) notFound();

  const contracts = documents.filter((doc) => doc.folder === "CONTRACTS");
  const signerName = matter.client.contactName ?? matter.client.name;

  return (
    <FormPage
      backHref={`/matters/${id}?tab=signatures`}
      backLabel="Back to matter"
      title="Request a signature"
      description="The signer gets a secure link by email and signs in their browser."
    >
      {contracts.length === 0 ? (
        <Card>
          <EmptyState
            icon="file"
            title="There is nothing to sign yet"
            description="Upload the document to this matter first, then send it for signature."
            action={
              <Link
                href={`/matters/${id}/upload`}
                className={buttonClasses("primary", "sm")}
              >
                Upload a PDF
              </Link>
            }
          />
        </Card>
      ) : (
        <form action={createSignatureRequest.bind(null, id)}>
          <FormCard>
            <Field
              label="Document"
              hint="The client signs this exact version. Later uploads will not change it."
            >
              <Select name="documentId" defaultValue={preselected}>
                {contracts.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {documentTitle(doc.name)} (v
                    {doc.versions[doc.versions.length - 1].versionNo})
                  </option>
                ))}
              </Select>
            </Field>

            <FieldRow>
              <Field label="Signer name">
                <Input name="signerName" required defaultValue={signerName} />
              </Field>
              <Field label="Signer email">
                <Input
                  type="email"
                  name="signerEmail"
                  required
                  defaultValue={matter.client.email}
                />
              </Field>
            </FieldRow>

            <Field label="Link expires after">
              <Select name="days" defaultValue="14">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </Select>
            </Field>

            <Field label="Message" hint="Optional. Appears in the email.">
              <Textarea
                name="message"
                rows={3}
                placeholder="Please review and sign the attached document. Call me if anything is unclear."
              />
            </Field>

            <Callout>
              One signer per document. The link is sent to this address alone,
              expires on its own, and can be revoked at any time.
            </Callout>

            <FormActions>
              <Link
                href={`/matters/${id}?tab=signatures`}
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
      )}
    </FormPage>
  );
}

export default function RequestSignaturePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  return (
    <Suspense fallback={<SkeletonCard rows={5} />}>
      <RequestSignature params={params} searchParams={searchParams} />
    </Suspense>
  );
}
