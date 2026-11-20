import { notFound } from "next/navigation";
import { Suspense } from "react";

import { updateClient } from "@/app/actions/clients";
import { ClientForm } from "@/components/clients/client-form";
import { FormPage } from "@/components/ui/form";
import { SkeletonCard } from "@/components/ui/skeleton";
import { getClient } from "@/lib/queries";

export const metadata = { title: "Edit client" };

type Params = Promise<{ id: string }>;

async function EditClient({ params }: { params: Params }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <ClientForm
      action={updateClient.bind(null, client.id)}
      values={{
        name: client.name,
        type: client.type,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone,
      }}
      submitLabel="Save changes"
    />
  );
}

export default function EditClientPage({ params }: { params: Params }) {
  return (
    <FormPage
      backHref="/clients"
      backLabel="Clients"
      title="Edit client"
      description="Changing the email address changes where future links are sent. Links already issued are unaffected."
    >
      <Suspense fallback={<SkeletonCard rows={4} />}>
        <EditClient params={params} />
      </Suspense>
    </FormPage>
  );
}
