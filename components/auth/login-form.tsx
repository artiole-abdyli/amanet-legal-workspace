"use client";

import { useActionState } from "react";

import { signIn, type LoginState } from "@/app/actions/auth";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, FormCard, Input } from "@/components/ui/form";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signIn,
    null,
  );

  return (
    <form action={formAction}>
      <FormCard>
        <Field label="Email address">
          <Input
            type="email"
            name="email"
            required
            autoComplete="username"
            autoFocus
            placeholder="you@harlowvance.example"
          />
        </Field>

        <Field label="Password">
          <Input
            type="password"
            name="password"
            required
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
    </form>
  );
}
