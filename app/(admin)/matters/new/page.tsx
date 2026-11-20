import { Suspense } from "react";

import { MatterForm } from "@/components/matters/matter-form";
import { FormPage } from "@/components/ui/form";
import { SkeletonCard } from "@/components/ui/skeleton";
import { getClientOptions } from "@/lib/queries";

export const metadata = { title: "New matter" };

async function NewMatterForm() {
  const clients = await getClientOptions();
  return <MatterForm clients={clients} />;
}

export default function NewMatterPage() {
  return (
    <FormPage
      backHref="/matters"
      backLabel="Matters"
      title="New matter"
      description="A matter is one piece of work for one client. Its reference is assigned automatically."
    >
      <Suspense fallback={<SkeletonCard rows={5} />}>
        <NewMatterForm />
      </Suspense>
    </FormPage>
  );
}
