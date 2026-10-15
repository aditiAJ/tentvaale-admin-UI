"use client";

// Replaces the root layout when it is the layout itself that fails, so it cannot rely on the app's
// providers or stylesheet: plain elements with inline styles only.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div role="alert" style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#666", margin: "0 0 16px" }}>
            The back office could not load. Try again, or reload the page.
          </p>
          <button onClick={reset} style={{ padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
