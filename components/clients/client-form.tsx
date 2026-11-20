"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { ClientFormState } from "@/app/actions/clients";
import { buttonClasses, Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import {
  Field,
  FieldRow,
  FormActions,
  FormCard,
  Input,
  Select,
} from "@/components/ui/form";

export type ClientValues = {
  name: string;
  type: "INDIVIDUAL" | "COMPANY";
  contactName: string | null;
  email: string;
  phone: string | null;
};

export function ClientForm({
  action,
  values,
  submitLabel,
}: {
  action: (
    state: ClientFormState,
    formData: FormData,
  ) => Promise<ClientFormState>;
  values?: ClientValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction}>
      <FormCard>
        <Field label="Client name">
          <Input
            name="name"
            required
            defaultValue={values?.name}
            placeholder="Person or company name"
          />
        </Field>

        <FieldRow>
          <Field label="Type">
            <Select name="type" defaultValue={values?.type ?? "INDIVIDUAL"}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="COMPANY">Company</option>
            </Select>
          </Field>
          <Field label="Contact person" hint="For companies.">
            <Input
              name="contactName"
              defaultValue={values?.contactName ?? ""}
              placeholder="Who signs and receives links"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Email">
            <Input
              type="email"
              name="email"
              required
              defaultValue={values?.email}
              placeholder="name@example.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              name="phone"
              defaultValue={values?.phone ?? ""}
              placeholder="Optional"
            />
          </Field>
        </FieldRow>

        <Callout>
          This email receives every secure upload and signing link. The client
          never creates an account or a password.
        </Callout>

        {state?.error ? (
          <p role="alert" className="font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <FormActions>
          <Link href="/clients" className={buttonClasses()}>
            Cancel
          </Link>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </FormActions>
      </FormCard>
    </form>
  );
}
