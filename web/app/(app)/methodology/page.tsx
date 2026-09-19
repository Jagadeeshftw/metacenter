import { getMeta } from "@/lib/api";
import { site } from "@/lib/site";
import { PageHeader, Panel } from "@/components/dash/ui";
import { ProvenanceGlyph, ProvenanceLegend } from "@/components/shared/provenance";
import type { Provenance } from "@/lib/api";
import readerLines from "@/data/reader-lines.json";

// Link a pox5-reader function name to its line in the contract source (the commit that is deployed).
const fnUrl = (fn: string) => {
  const line = (readerLines.lines as Record<string, number>)[fn];
  return line ? `${site.repo}/blob/${readerLines.commit}/${readerLines.path}#L${line}` : null;
};
const POX5_SRC = `${site.repo}/blob/main/research/pox-5.deployed.clar`;

export const revalidate = 300;
export const metadata = { title: "Methodology", alternates: { canonical: "/methodology" }, openGraph: { url: "/methodology" } };

const R = "pox5-reader";
const ROWS: { metric: string; formula: string; unit: string; label: Provenance; source: string; api: string; fn?: string }[] = [
  { fn: "get-coverage-for-cycle", metric: "Coverage (cycle)", formula: "pool ÷ obligation, over the cycle's computed distributions", unit: "×", label: "onchain", source: `${R}::get-coverage-for-cycle(cycle) → coverage-bps`, api: "/metrics/current coverage · /metrics/cycles/:n coverage" },
  { fn: "get-coverage-summary", metric: "Headroom", formula: "1 − obligation ÷ pool", unit: "%", label: "onchain", source: `${R}::get-coverage-summary → headroom-bps`, api: "/metrics/current headroom" },
  { fn: "get-obligation-per-interval", metric: "Obligation per interval", formula: "Σ over active bonds of shares × target-rate ÷ 10000 ÷ 50 (pox-5 L2266)", unit: "sats", label: "onchain", source: `${R}::get-obligation-per-interval(cycle)`, api: "/metrics/current obligation_per_interval" },
  { fn: "get-bond-payout-order", metric: "Bond payout order", formula: "descending stx-value-ratio, ties to the lower bond index", unit: "bonds", label: "onchain", source: `${R}::get-bond-payout-order(cycle)`, api: "/bonds/order" },
  { fn: "get-reserve", metric: "Reserve", formula: "pox-5 reserve-balance", unit: "sats", label: "onchain", source: `${R}::get-reserve`, api: "/metrics/current reserve" },
  { fn: "get-reserve-cover-cycles", metric: "Hypothetical cover", formula: "reserve ÷ (2 × obligation per interval)", unit: "cycles", label: "onchain", source: `${R}::get-reserve-cover-cycles(cycle)`, api: "/metrics/current reserve_cover" },
  { fn: "get-pending-pool", metric: "Pending pool", formula: "sBTC balance − staked − reserve − accounted (never aborts)", unit: "sats", label: "onchain", source: `${R}::get-pending-pool`, api: "/metrics/current pending_pool" },
  { metric: "Pool per distribution", formula: "gross-accrued-rewards", unit: "sats", label: "mirrored", source: "calculate-rewards event; risk-feed gross-pool-sats", api: "/intervals gross_pool" },
  { metric: "Owed per distribution", formula: "Σ target-yield of bond-distribution events", unit: "sats", label: "mirrored", source: "bond-distribution events; risk-feed bond-target-sats", api: "/intervals obligation" },
  { metric: "Coverage per distribution", formula: "pool ÷ owed; n/a when nothing is owed", unit: "×", label: "mirrored", source: "risk-feed coverage-bps (derived on-chain from posted inputs)", api: "/intervals coverage" },
  { metric: "Reserve deposit and state", formula: "reserve-deposit; > 0 → not drawing, 0 → flat", unit: "sats", label: "mirrored", source: "calculate-rewards event; equals the reserve delta in pox-5 state", api: "/intervals reserve_deposit · /metrics/current reserve_state" },
  { metric: "STX-only realised yield", formula: "total-stx-staker-rewards ÷ cycle-staked-ustx × 1e6", unit: "sats/STX", label: "mirrored", source: "calculate-rewards event; risk-feed stx-yield-sats-per-stx-e9", api: "/intervals stx_only_yield" },
  { metric: "STX-only APY (BTC terms)", formula: "yield × 50 ÷ STX/BTC price at the distribution", unit: "%", label: "mirrored", source: "price: CoinGecko hourly (Coinbase STX-USD/BTC-USD fallback), stored with source and timestamp", api: "/intervals stx_only_apy_btc" },
  { metric: "Cliff price", formula: "price × obligation ÷ pool (assumes miner bids scale with price)", unit: "sats/STX", label: "mirrored", source: "risk-feed cliff-sats-per-stx-e6", api: "/metrics/current cliff.price" },
  { fn: "simulate-waterfall", metric: "Stress results", formula: "pool × (1 − commit drop) × (1 − price drop), split in pox-5 order", unit: "sats, ×, %", label: "hypothetical", source: `/stress; ${R}::simulate-waterfall for the current book`, api: "/stress" },
];

export default async function Methodology() {
  const meta = await getMeta();
  const contracts = [
    { name: "pox5-reader", network: "mainnet" as const, id: meta?.reader ?? null, role: "onchain figures, read-only, holds no funds" },
    { name: "risk-feed-trait", network: "mainnet" as const, id: meta?.trait.mainnet ?? null, role: "interface implemented by pox5-reader" },
    { name: "risk-feed", network: "testnet" as const, id: meta?.feed ?? null, role: "mirrored per-distribution records with raw inputs" },
    { name: "risk-feed-trait", network: "testnet" as const, id: meta?.trait.testnet ?? null, role: "interface implemented by risk-feed" },
    { name: "coverage-guard", network: "testnet" as const, id: meta?.guard ?? null, role: "example consumer: ok / paused" },
    { name: "pox-5", network: "mainnet" as const, id: meta?.pox5 ?? "SP000000000000000000002Q6VF78.pox-5", role: "the Bitcoin Staking boot contract" },
  ];

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader title="Methodology" lead="Every number maps to a contract call or an API field. If a figure cannot be recomputed from public data, it is not shown.">
        <ProvenanceLegend />
      </PageHeader>

      <Panel title="Every metric and its source">
        <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-xs text-subtle">
                <th className="py-2 pr-3 font-medium">Metric</th>
                <th className="pr-3 font-medium">Formula</th>
                <th className="pr-3 font-medium">Unit</th>
                <th className="pr-3 font-medium">Label</th>
                <th className="pr-3 font-medium">Contract / event</th>
                <th className="font-medium">API field</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.metric} className="border-t border-line align-top">
                  <td className="py-3 pr-3 font-medium">{r.metric}</td>
                  <td className="py-3 pr-3 text-muted">{r.formula}</td>
                  <td className="py-3 pr-3 text-muted">{r.unit}</td>
                  <td className="py-3 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <ProvenanceGlyph kind={r.label} />
                      {r.label}
                    </span>
                  </td>
                  <td className="num py-3 pr-3 text-xs">
                    {r.fn && fnUrl(r.fn) ? (
                      <>
                        <a className="text-brand underline-offset-4 hover:underline" href={fnUrl(r.fn)!}>
                          {r.source}
                        </a>
                        {meta?.reader && (
                          <>
                            {" · "}
                            <a className="text-muted underline-offset-4 hover:underline" href={site.explorer(meta.reader, "mainnet")}>
                              mainnet contract
                            </a>
                          </>
                        )}
                      </>
                    ) : (
                      r.source
                    )}
                  </td>
                  <td className="num py-3 text-xs text-muted">{r.api}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="How pox-5 pays out">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>Once per distribution interval (1,050 Bitcoin blocks, two per reward cycle) anyone may call calculate-rewards. The sBTC received since the last call is the gross pool.</li>
          <li>Bonds are paid first, in descending stx-value-ratio; ties go to the lower bond index (L2285–2299). Each gets min(target, what is left).</li>
          <li>Within a bond, rewards are flat per token: every staked sat earns the same (L2304–2309).</li>
          <li>15% of what remains goes to the reserve (L2190); STX-only stakers get the other 85%.</li>
          <li>The reserve never pays bonds. transfer-from-reserve (L2696) is private and never called; that needs a SIP. In a shortfall the reserve stays flat.</li>
        </ol>
        <p className="text-xs text-subtle">
          Line numbers refer to the <a className="underline underline-offset-4" href={POX5_SRC}>deployed source</a>, identical to stacks-core tag 4.0.1 (commit 62e03cc).
        </p>
      </Panel>

      <Panel title="The zero-yield cliff">
        <p className="text-sm leading-relaxed">
          The headline is price-free: the pool can fall by 1 − 1/coverage before bonds absorb all of it. Converting that to
          a sats/STX price assumes miner BTC bids scale with the STX price. They only roughly do: pool per sat/STX of price
          ranged 0.58M–0.89M sats across distributions 282–286.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line p-4 text-sm">
            <p className="font-medium">friedger&apos;s ~171 sats/STX, reproduced (hypothetical)</p>
            <p className="num mt-2 text-xs">3,000 BTC × 3% ÷ (1,000 STX/block × 52,560 blocks/year) = 171.23 sats/STX</p>
            <p className="mt-2 text-xs text-muted">
              Inputs are the SIP&apos;s hypothetical launch book (
              <a className="underline underline-offset-4" href="https://forum.stacks.org/t/introducing-the-bitcoin-staking-sip-v1-draft/18862/14">forum post #14</a>
              ). The same inputs give his 1.65× coverage at 282 sats/STX.
            </p>
          </div>
          <div className="rounded-xl border border-line p-4 text-sm">
            <p className="font-medium">3,000 BTC at today&apos;s pool (hypothetical)</p>
            <p className="num mt-2 text-xs">price × 180,000,000 sats ÷ latest pool</p>
            <p className="mt-2 text-xs text-muted">180,000,000 sats = 3,000 BTC × 3% ÷ 50, the book&apos;s obligation per interval.</p>
          </div>
        </div>
      </Panel>

      <Panel title="Where the pool comes from">
        <p className="text-sm leading-relaxed">
          Under PoX-5 every Stacks block-commit pays one output to the sBTC deposit address; nothing is burned. In
          distribution 286, 705 of 1,050 Bitcoin blocks carried commits (five miners, 332,500 sats per block); the other
          345 had no sortition. The stress test&apos;s miner-commit drop cuts that total directly.{" "}
          <a className="underline underline-offset-4" href={`${site.repo}/tree/main/research/missing-blocks`}>
            Evidence
          </a>
          .
        </p>
      </Panel>

      <Panel title="How the data is verified">
        <p className="text-sm leading-relaxed">
          Each distribution is located by reading last-reward-compute-height at historical chain tips (call-read ?tip=),
          taken from its calculate-rewards transaction, and recomputed independently from pox-5 state just before and after
          that block: the reserve delta and rewards-per-token × shares. So far every distribution matches within 2 sats and
          the reserve delta matches exactly. The indexer does not use the deprecated contract-events endpoint.
        </p>
      </Panel>

      <div id="contracts" className="scroll-mt-24">
        <Panel title="Contracts">
          <ul className="flex flex-col divide-y divide-line text-sm">
            {contracts.map((c) => (
              <li key={`${c.name}-${c.network}`} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between">
                <span>
                  <b className="font-medium">{c.name}</b> <span className="text-muted">· {c.network} · {c.role}</span>
                </span>
                {c.id ? (
                  <a className="num break-all text-xs text-brand underline-offset-4 hover:underline" href={site.explorer(c.id, c.network)}>
                    {c.id}
                  </a>
                ) : (
                  <span className="text-xs text-muted">deploying</span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-subtle">Testnet feed values mirror mainnet data.</p>
          <p className="text-xs text-subtle">
            Site <a className="num underline underline-offset-4" href={site.url}>{site.url.replace("https://", "")}</a> · API{" "}
            <a className="num underline underline-offset-4" href={`${site.apiBase}/metrics/current`}>{site.apiBase.replace("https://", "")}</a> · source{" "}
            <a className="underline underline-offset-4" href={site.repo}>GitHub</a>
          </p>
        </Panel>
      </div>
    </div>
  );
}
