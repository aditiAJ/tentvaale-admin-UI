"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/services/api-client";
import {
  listPolicies,
  policyHistory,
  publishPolicy,
  settingsKeys,
  type Policy,
  type PolicyKind,
} from "@/features/settings/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const LABEL: Record<PolicyKind, string> = {
  CANCELLATION: "Cancellation policy",
  DAMAGE: "Damage policy",
  DELIVERY: "Delivery policy",
  TERMS: "Terms and conditions",
};

/**
 * The text the quotation points customers to. The storefront hosts each page; every edit is a new
 * version, and a quotation keeps linking to the version it was sent with.
 */
export function PoliciesPage() {
  const policies = useQuery({ queryKey: settingsKeys.policies, queryFn: ({ signal }) => listPolicies(signal) });
  if (policies.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (policies.isError) return <Alert tone="error" title="Could not load the policies." />;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Policies</h2>
        <p className="text-sm text-muted-foreground">
          Publishing creates a new version. Quotations already sent keep the version they were sent with.
        </p>
      </header>
      {policies.data.map((policy) => (
        <PolicyEditor key={`${policy.kind}-${policy.version}`} policy={policy} />
      ))}
    </div>
  );
}

function PolicyEditor({ policy }: { policy: Policy }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(policy.title);
  const [body, setBody] = useState(policy.version === 0 ? "" : policy.body);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const history = useQuery({
    queryKey: settingsKeys.history(policy.kind),
    queryFn: ({ signal }) => policyHistory(policy.kind, signal),
    enabled: showHistory,
  });

  const publish = useMutation({
    mutationFn: () => publishPolicy(policy.kind, { title: title.trim(), body }),
    onSuccess: (saved) => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: settingsKeys.policies });
      queryClient.invalidateQueries({ queryKey: settingsKeys.history(policy.kind) });
      toast.success(`${LABEL[policy.kind]} published as version ${saved.version}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not publish the policy."),
  });

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">{LABEL[policy.kind]}</h2>
        <span className="text-xs text-muted-foreground">
          {policy.version === 0 ? "Not published yet" : `Version ${policy.version}`}
        </span>
      </div>
      {error ? <Alert tone="error" title={error} /> : null}
      <Field label="Title" required>
        {(props) => <Input {...props} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />}
      </Field>
      <Field label="Text" required>
        {(props) => <Textarea {...props} rows={8} value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={() => publish.mutate()} disabled={publish.isPending || title.trim() === "" || body.trim() === ""}>
          {publish.isPending ? <Loader2 className="animate-spin" /> : null}
          Publish new version
        </Button>
        <button type="button" className="text-sm text-primary hover:underline" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? "Hide history" : "Version history"}
        </button>
      </div>
      {showHistory ? (
        <ul className="space-y-1 text-sm">
          {(history.data ?? []).map((v) => (
            <li key={v.version} className="flex justify-between gap-3">
              <span>
                Version {v.version}: {v.title}
              </span>
              <span className="text-muted-foreground">
                {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString("en-IN") : ""}
              </span>
            </li>
          ))}
          {history.data?.length === 0 ? <li className="text-muted-foreground">Nothing published yet.</li> : null}
        </ul>
      ) : null}
    </section>
  );
}
