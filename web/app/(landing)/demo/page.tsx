import type { Metadata } from "next";
import Link from "next/link";
import { DemoVideo } from "@/components/shared/demo-video";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Demo video",
  description: "Metacenter in 2:54: coverage and headroom, the stress test, the reserve, two read-only calls on mainnet, and npm run verify.",
  alternates: { canonical: "/demo" },
  openGraph: { url: "/demo", images: [{ url: "/video/poster.webp", width: 1920, height: 1080 }] },
};

export default function DemoPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-32 md:px-8 md:pt-40">
      <p className="text-xs uppercase tracking-widest text-brand">Demo</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Metacenter in {site.demo.length}</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Coverage and headroom on the dashboard, the stress test, the reserve, two real read-only calls on mainnet, and{" "}
        <code className="num text-sm">npm run verify</code> from a fresh clone.
      </p>
      <div className="mt-8">
        <DemoVideo priority />
      </div>
      <p className="mt-3 text-sm text-muted">{site.demo.asOf} Live figures are on the <Link href="/dashboard" className="text-brand underline underline-offset-4">dashboard</Link>.</p>
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <span className="text-muted">Subtitles are built into the video.</span>
        <a href={site.demo.srt} download className="text-brand underline underline-offset-4">Download captions (.srt)</a>
        {site.demo.watchUrl && (
          <a href={site.demo.watchUrl} className="text-brand underline underline-offset-4">Watch on YouTube</a>
        )}
      </div>
    </main>
  );
}
