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
  ValidatedForm,
} from "@/components/ui/form";
import { LIMITS, todayInput } from "@/lib/validation";

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
  // Nothing is pre-selected: a matter filed under the wrong client is a
  // confidentiality problem, so the Admin has to choose one deliberately.
  // With no clients yet, the form opens on "add a new client".
  const [clientId, setClientId] = useState(clients.length ? "" : "__new");

  return (
    <ValidatedForm action={formAction} serverErrors={state?.fields}>
      <FormCard>
        <Field label="Matter title" required>
          <Input
            name="title"
            required
            data-max={LIMITS.title}
            data-msg-required="Give the matter a title."
            placeholder="e.g. Commercial lease, Unit 4"
          />
        </Field>

        <FieldRow>
          <Field label="Client" required>
            <Select
              name="clientId"
              required
              data-msg-required="Choose a client for this matter."
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              <option value="" disabled>
                Choose a client…
              </option>
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
              <Field label="New client name" required>
                <Input
                  name="newClientName"
                  required
                  data-max={LIMITS.name}
                  data-msg-required="Enter the new client's name."
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
              required
            >
              <Input
                type="email"
                name="newClientEmail"
                required
                data-msg-required="Enter the new client's email address."
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
            <Input
              type="date"
              name="deadline"
              defaultValue={inSevenWeeks()}
              min={todayInput()}
              data-msg-min="A new matter's deadline can't be in the past."
              // The browser and the server can disagree about "today" around
              // midnight; the attribute is only a hint, the server decides.
              suppressHydrationWarning
            />
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
    </ValidatedForm>
  );
}
