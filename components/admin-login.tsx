"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/localize";
import { useSiteLang } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AdminLogin() {
  const copy = ui(useSiteLang());
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/bookings/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!response.ok) {
        setError(response.status === 404 ? copy.secretMissing : copy.secretWrong);
        return;
      }
      setSecret("");
      router.refresh();
    } catch {
      setError(copy.connectionDropped);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md">
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="view-secret">{copy.viewSecret}</FieldLabel>
          <Input
            id="view-secret"
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            className="h-11"
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
      </FieldGroup>
      <Button type="submit" className="mt-4 min-h-11" disabled={pending}>
        {pending ? copy.checking : copy.openRequests}
      </Button>
    </form>
  );
}

export function AdminLogout() {
  const copy = ui(useSiteLang());
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      className="min-h-11"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void fetch("/api/bookings/session", { method: "DELETE" }).then(() => {
          router.refresh();
          setPending(false);
        });
      }}
    >
      {copy.lockView}
    </Button>
  );
}
