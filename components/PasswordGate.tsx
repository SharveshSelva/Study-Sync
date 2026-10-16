"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Button, Callout, Card, Field, Input, Spinner } from "@/components/ui";
import { PASSWORD_HEADER, storePassword, storedPassword } from "@/lib/client";

type State = "checking" | "open" | "locked";

/**
 * Wraps the app in a shared-password prompt when APP_PASSWORD is set on the
 * server. Unset — the normal local case — this renders children immediately
 * and costs nothing.
 *
 * This is a demo gate, not an authentication system: one shared password, no
 * accounts. Its job is to stop a public URL from being spammed, and the API
 * routes check the password themselves, so a determined user cannot bypass it
 * by skipping the UI.
 */
export function PasswordGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("checking");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const response = await fetch("/api/gate");
        const data = (await response.json()) as { required?: boolean };

        if (!active) return;
        if (!data.required) {
          setState("open");
          return;
        }

        // A password is required; see whether the stored one still works.
        const saved = storedPassword();
        if (!saved) {
          setState("locked");
          return;
        }

        const verify = await fetch("/api/gate", {
          method: "POST",
          headers: { [PASSWORD_HEADER]: saved },
        });
        if (active) setState(verify.ok ? "open" : "locked");
      } catch {
        // If the check itself fails, do not lock the user out of a local app.
        if (active) setState("open");
      }
    }

    void check();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/gate", {
        method: "POST",
        headers: { [PASSWORD_HEADER]: value },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "That password is not right.");
      }
      storePassword(value);
      setState("open");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check that password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "checking") {
    return (
      <div className="grid min-h-[60dvh] place-items-center text-muted">
        <Spinner />
      </div>
    );
  }

  if (state === "locked") {
    return (
      <div className="mx-auto grid min-h-[60dvh] max-w-md place-items-center">
        <Card className="w-full">
          <h1 className="text-lg font-semibold tracking-tight">StudySync</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This demo is password protected so the API quota behind it does not get spent by
            passers-by. Enter the password you were given.
          </p>

          <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
            <Field label="Demo password" htmlFor="demo-password">
              <Input
                id="demo-password"
                type="password"
                autoFocus
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error ? <Callout>{error}</Callout> : null}

            <Button type="submit" disabled={submitting || value.length === 0}>
              {submitting ? <Spinner label="Checking…" /> : "Unlock"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
