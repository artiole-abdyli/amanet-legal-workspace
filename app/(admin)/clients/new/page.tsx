import { createClient } from "@/app/actions/clients";
import { ClientForm } from "@/components/clients/client-form";
import { FormPage } from "@/components/ui/form";

export const metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <FormPage
      backHref="/clients"
      backLabel="Clients"
      title="New client"
      description="A client record holds who they are and where their secure links are sent."
    >
      <ClientForm action={createClient} submitLabel="Create client" />
    </FormPage>
  );
}
