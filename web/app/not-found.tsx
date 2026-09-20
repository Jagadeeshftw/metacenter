import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-lg flex-col items-start gap-4 px-6 py-24">
      <h1 className="text-2xl font-medium">Page not found</h1>
      <p className="text-sm text-muted">The page you asked for does not exist.</p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/" className="rounded-lg border border-line px-3 py-2 hover:bg-panel">Home</Link>
        <Link href="/dashboard" className="rounded-lg border border-line px-3 py-2 hover:bg-panel">Dashboard</Link>
        <Link href="/docs" className="rounded-lg border border-line px-3 py-2 hover:bg-panel">Docs</Link>
      </div>
    </main>
  );
}
