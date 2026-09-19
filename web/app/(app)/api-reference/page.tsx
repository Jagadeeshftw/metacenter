import { PageHeader, Panel } from "@/components/dash/ui";
import { site } from "@/lib/site";

export const metadata = { title: "API", alternates: { canonical: "/api-reference" }, openGraph: { url: "/api-reference" } };

const ENDPOINTS = [
  { path: "/metrics/current", about: "Coverage, headroom, obligation, pending pool, reserve and hypothetical cover, payout order, the latest distribution and the cliff figures." },
  { path: "/metrics/cycles/143", about: "pox5-reader::get-coverage-for-cycle(n), the Hiro v3 cycle record, and the cycle's distributions." },
  { path: "/intervals", about: "Every distribution since cycle 141, with cross-check results and testnet publication status." },
  { path: "/bonds/order", about: "Bond payout order in pox-5 order. Optional ?cycle=." },
  { path: "/stress?commit_drop=0.3&price_drop=0.5", about: "Hypothetical waterfall. Add &book_btc=3000&bonds=6 for a hypothetical book." },
  { path: "/meta", about: "Contract addresses used by the site." },
];

export default function ApiReference() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="API"
        lead="Read-only JSON, free, no key. The same data the dashboard uses."
      />
      <Panel title="Base URL">
        <p className="num text-base">{site.apiBase}</p>
        <p className="text-sm text-muted">Example: <a className="num text-brand underline-offset-4 hover:underline" href={`${site.apiBase}/metrics/current`}>{site.apiBase}/metrics/current</a></p>
      </Panel>
      <Panel title="Field envelope">
        <p className="text-sm text-muted">Every metric is returned with its unit, its provenance label and its source.</p>
        <pre className="num overflow-x-auto rounded-xl bg-surface-2 p-4 text-xs leading-relaxed">{`{
  "value": 16.678,
  "unit": "x",
  "provenance": "onchain" | "mirrored" | "hypothetical",
  "source": "pox5-reader::get-coverage-summary …",
  "note": "optional"
}`}</pre>
      </Panel>
      <Panel title="Endpoints">
        <ul className="flex flex-col divide-y divide-line">
          {ENDPOINTS.map((e) => (
            <li key={e.path} className="flex flex-col gap-1 py-3">
              <a href={`${site.apiBase}${e.path}`} className="num break-all text-sm text-brand underline-offset-4 hover:underline">
                GET {site.apiBase}{e.path}
              </a>
              <span className="text-sm text-muted">{e.about}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-subtle">
          Source and schema: <a className="underline underline-offset-4" href={`${site.repo}/tree/main/indexer`}>indexer/</a> in the repository.
        </p>
      </Panel>
    </div>
  );
}
