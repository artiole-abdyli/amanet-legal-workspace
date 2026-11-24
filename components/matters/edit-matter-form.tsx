"use client";

import Link from "next/link";
import { useActionState } from "react";

import { updateMatter, type MatterFormState } from "@/app/actions/matters";
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
import { LIMITS } from "@/lib/validation";

const PRACTICE_AREAS = [
  "Property",
  "Commercial",
  "Employment",
  "Private client",
  "Litigation",
];

export function EditMatterForm({
  matterId,
  title,
  practiceArea,
  priority,
  status,
  deadline,
}: {
  matterId: string;
  title: string;
  practiceArea: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "ACTIVE" | "ON_HOLD" | "CLOSED";
  /** Already formatted as yyyy-mm-dd, or empty. */
  deadline: string;
}) {
  const [state, formAction, pending] = useActionState<MatterFormState, FormData>(
    updateMatter.bind(null, matterId),
    null,
  );

  // A practice area typed before this list existed should not be lost.
  const areas = PRACTICE_AREAS.includes(practiceArea)
    ? PRACTICE_AREAS
    : [practiceArea, ...PRACTICE_AREAS];

  return (
    <ValidatedForm action={formAction} serverErrors={state?.fields}>
      <FormCard>
        <Field label="Matter title" required>
          <Input
            name="title"
            required
            defaultValue={title}
            data-max={LIMITS.title}
            data-msg-required="Give the matter a title."
          />
        </Field>

        <FieldRow>
          <Field label="Practice area">
            <Select name="practiceArea" defaultValue={practiceArea}>
              {areas.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={status}>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On hold</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Priority">
            <Select name="priority" defaultValue={priority}>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Select>
          </Field>
          <Field
            label="Deadline"
            hint="Leave empty if the matter has no fixed end."
          >
            <Input type="date" name="deadline" defaultValue={deadline} />
          </Field>
        </FieldRow>

        {state?.error ? (
          <p role="alert" className="font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <FormActions>
          <Link href={`/matters/${matterId}`} className={buttonClasses()}>
            Cancel
          </Link>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </FormActions>
      </FormCard>
    </ValidatedForm>
  );
}
