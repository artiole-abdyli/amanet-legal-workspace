"use server";

import { requireAdmin } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getFirm } from "@/lib/queries";
import {
  LIMITS,
  createChecker,
  isPhone,
  type FieldErrors,
} from "@/lib/validation";

export type ClientFormState = { error?: string; fields?: FieldErrors } | null;

/** Reads and checks the form together, so every problem comes back at once. */
function read(formData: FormData) {
  const check = createChecker(formData);
  const input = {
    name: check.text("name", {
      required: "Enter the client's name.",
      max: LIMITS.name,
      label: "Client name",
    }),
    type:
      formData.get("type") === "COMPANY"
        ? ("COMPANY" as const)
        : ("INDIVIDUAL" as const),
    contactName:
      check.text("contactName", { max: LIMITS.name, label: "Contact person" }) ||
      null,
    email: check.email("email", {
      required: "Enter the client's email address. Every secure link is sent here.",
    }),
    phone: check.text("phone", { max: LIMITS.phone, label: "Phone" }) || null,
  };
  if (input.phone && !check.errors.phone && !isPhone(input.phone)) {
    check.fail(
      "phone",
      "Enter a phone number with at least six digits, like +383 44 123 456.",
    );
  }
  return { input, errors: check.errors, ok: check.ok };
}

export async function createClient(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireAdmin();
  const { input, errors, ok } = read(formData);
  if (!ok) return { fields: errors };

  const firm = await getFirm();
  await prisma.client.create({ data: { firmId: firm.id, ...input } });

  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClient(
  clientId: string,
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireAdmin();
  const { input, errors, ok } = read(formData);
  if (!ok) return { fields: errors };

  await prisma.client.update({ where: { id: clientId }, data: input });

  revalidatePath("/clients");
  redirect("/clients");
}
