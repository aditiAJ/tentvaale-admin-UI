"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "@/features/auth";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/services/api-client";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Back-office data changes as colleagues work, but not by the second.
        // Half a minute is long enough to make tab-switching feel instant and
        // short enough that a stale price is not acted on.
        staleTime: 30_000,
        // Retrying a 401, 403 or 422 just repeats a refusal the server already
        // explained. Only genuine transport and server faults are worth another
        // attempt.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Created in state, not at module scope: a module-level client would be
  // shared across requests on the server and leak one user's cache into
  // another's render.
  const [queryClient] = useState(makeQueryClient);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
