"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { login } from "@/features/auth/api";
import { useSession } from "@/features/auth/session";
import { ApiError } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { readSession } from "@/services/jwt";
import { DEMO_LOGINS, DEMO_PASSWORD } from "@/mock-data/seed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const schema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { accessToken } = await login(values);

      // Reject a token the app cannot act on before storing it, rather than
      // signing in and dumping the user on a dashboard that 403s everywhere.
      // In practice this catches a storefront token reaching the admin login.
      if (!readSession(accessToken)) {
        setFormError("That account cannot sign in to the back office.");
        return;
      }

      signIn(accessToken);
      // `next` is set by the route guard so a deep link survives the detour
      // through login. Only same-origin paths are honoured — an absolute URL
      // here would be an open redirect.
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 401
          ? "Incorrect username or password."
          : error instanceof Error
            ? error.message
            : "Could not sign in.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? <Alert tone="error" title={formError} /> : null}

      <Field label="Username" required error={errors.username?.message}>
        {(props) => (
          <Input
            {...props}
            {...register("username")}
            autoComplete="username"
            autoFocus
            placeholder="your.name"
          />
        )}
      </Field>

      <Field label="Password" required error={errors.password?.message}>
        {(props) => (
          <Input
            {...props}
            {...register("password")}
            type="password"
            autoComplete="current-password"
          />
        )}
      </Field>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : null}
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      {IS_MOCK ? (
        // Roles are the most interesting thing to try in a data-less build —
        // each one produces a visibly different menu — so they are one click
        // rather than a password to go and look up.
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium">Demo accounts</p>
          <div className="grid gap-1.5">
            {DEMO_LOGINS.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => {
                  setValue("username", account.username, { shouldValidate: true });
                  setValue("password", DEMO_PASSWORD, { shouldValidate: true });
                }}
                className="flex items-baseline justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted"
              >
                <span className="font-medium">{account.username}</span>
                <span className="shrink-0 text-muted-foreground">{account.blurb}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Password for all of them is <code className="font-mono">{DEMO_PASSWORD}</code>.
          </p>
        </div>
      ) : null}
    </form>
  );
}
