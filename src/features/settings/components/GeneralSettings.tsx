"use client";

import { useState } from "react";
import { KeyRound, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSession } from "@/features/auth";
import { HeroImagePanel } from "@/features/settings/components/HeroImagePanel";
import { CatalogueListsPanel } from "@/features/settings/components/CatalogueListsPanel";
import { ChangePasswordDialog } from "@/features/users/components/ChangePasswordDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/**
 * Everything that is not the business's own details (those are under Company settings): how the back office looks and
 * acts for the person signed in (their theme and password), and the lists the product form and the storefront filters
 * offer (mood, theme fit, colours, occasions and so on), which a business can change without a developer.
 */
export function GeneralSettings() {
  const { theme, setTheme } = useTheme();
  const { session } = useSession();
  const [changingPassword, setChangingPassword] = useState(false);

  return (
    <div className="space-y-6">
      {/* The two personal cards side by side, the same height, so the page starts level. */}
      <div className={cn("grid gap-4", session && "md:grid-cols-2")}>
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold">Appearance</h2>
          <p className="text-xs text-muted-foreground">The colours of this back office on this device. The quotation, invoice and dispatch PDFs follow it.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors",
                theme === value ? "border-primary bg-primary/10 font-medium" : "border-border bg-card hover:border-primary/40",
              )}
            >
              <Icon className={cn("size-4", theme === value ? "text-primary" : "text-muted-foreground")} />
              {label}
            </button>
          ))}
        </div>
      </Card>

      {session ? (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">Your account</h2>
            <p className="text-xs text-muted-foreground">Signed in as {session.role}.</p>
          </div>
          <Button variant="outline" onClick={() => setChangingPassword(true)}>
            <KeyRound /> Change password
          </Button>
        </Card>
      ) : null}
      </div>

      <HeroImagePanel />

      <CatalogueListsPanel />

      {changingPassword ? <ChangePasswordDialog onClose={() => setChangingPassword(false)} /> : null}
    </div>
  );
}
