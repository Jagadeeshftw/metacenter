"use client";

// Last resort: a failure in the root layout itself. Plain markup, no imports that could fail.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#07090c", color: "#e9eef2", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 24px", display: "grid", gap: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Metacenter is having a problem</h1>
          <p style={{ color: "#a9b4bf", lineHeight: 1.6, margin: 0 }}>
            The risk figures are published from public data and can be checked independently at any time.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={reset} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #1d2530", background: "transparent", color: "inherit" }}>
              Try again
            </button>
            <a href="/api/health" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #1d2530", color: "#26a596" }}>
              Service health
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
