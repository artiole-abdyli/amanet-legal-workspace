"use client";

import { useActionState } from "react";

import { signIn, type LoginState } from "@/app/actions/auth";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, FormCard, Input, ValidatedForm } from "@/components/ui/form";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signIn,
    null,
  );

  return (
    <ValidatedForm action={formAction} serverErrors={state?.fields}>
      <FormCard>
        <Field label="Email address" required>
          <Input
            type="email"
            name="email"
            required
            data-msg-required="Enter your email address."
            autoComplete="username"
            autoFocus
            placeholder="you@abdylipartners.example"
          />
        </Field>

        <Field label="Password" required>
          <Input
            type="password"
            name="password"
            required
            data-msg-required="Enter your password."
            autoComplete="current-password"
          />
        </Field>

        {state?.error ? (
          <p role="alert" className="font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          <Icon name="lock" />
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </FormCard>
    </ValidatedForm>
  );
}
