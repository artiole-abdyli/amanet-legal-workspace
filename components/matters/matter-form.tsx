"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createMatter, type MatterFormState } from "@/app/actions/matters";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  Field,
  FieldRow,
  FormActions,
  FormCard,
  Input,
  Select,
} from "@/components/ui/form";

const PRACTICE_AREAS = [
  "Property",
  "Commercial",
  "Employment",
  "Private client",
  "Litigation",
];

function inSevenWeeks() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

export function MatterForm({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<MatterFormState, FormData>(
    createMatter,
    null,
  );
  const [clientId, setClientId] = useState(clients[0]?.id ?? "__new");

  return (
    <form action={formAction}>
      <FormCard>
        <Field label="Matter title">
          <Input
            name="title"
            required
            placeholder="e.g. Commercial lease, Unit 4"
          />
        </Field>

        <FieldRow>
          <Field label="Client">
            <Select
              name="clientId"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
              <option value="__new">+ Add a new client</option>
            </Select>
          </Field>
          <Field label="Practice area">
            <Select name="practiceArea" defaultValue="Property">
              {PRACTICE_AREAS.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </Select>
          </Field>
        </FieldRow>

        {clientId === "__new" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-3.5">
            <FieldRow>
              <Field label="New client name">
                <Input
                  name="newClientName"
                  placeholder="Person or company name"
                />
              </Field>
              <Field label="Type">
                <Select name="newClientType" defaultValue="INDIVIDUAL">
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="COMPANY">Company</option>
                </Select>
              </Field>
            </FieldRow>
            <Field
              label="Email"
              hint="Upload and signing links are sent to this address."
            >
              <Input
                type="email"
                name="newClientEmail"
                placeholder="name@example.com"
              />
            </Field>
          </div>
        ) : null}

        <FieldRow>
          <Field label="Priority">
            <Select name="priority" defaultValue="MEDIUM">
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Select>
          </Field>
          <Field label="Deadline" hint="Recorded as the first key date.">
            <Input type="date" name="deadline" defaultValue={inSevenWeeks()} />
          </Field>
        </FieldRow>

        {state?.error ? (
          <p role="alert" className="font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <FormActions>
          <Link href="/matters" className={buttonClasses()}>
            Cancel
          </Link>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Creating…" : "Create matter"}
          </Button>
        </FormActions>
      </FormCard>
    </form>
  );
}
