"use client";

// Nothing on the dashboard should reach this: the data layer falls back to the last known
// figures instead of throwing. It exists so that if something else does fail, a visitor sees a
// page with a way forward rather than a stack trace.
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 py-24">
      <h1 className="text-2xl font-medium">This page could not be rendered</h1>
      <p className="text-sm text-muted">
        The figures come from a public API; if it is briefly unavailable the page normally falls back to the last published
        values. This looks like something else. The numbers themselves are always verifiable from public sources.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <button onClick={reset} className="rounded-lg border border-line px-3 py-2 hover:bg-panel">
          Try again
        </button>
        <a href="/api/health" className="rounded-lg border border-line px-3 py-2 hover:bg-panel">
          Service health
        </a>
        <a href="/docs/verification/recompute" className="rounded-lg border border-line px-3 py-2 hover:bg-panel">
          Verify the numbers yourself
        </a>
      </div>
    </div>
  );
}
