// Live figures for the docs. Every value here is read from the same public API as the
// dashboard at render time (revalidated every 60 s) and shown with its provenance label and
// the Bitcoin block it was read at. Nothing that changes is hardcoded in the MDX.
import { getCurrent, getIntervals, getMeta, getPath, getStress } from "@/lib/api";
import { btc, int, pct, satsExact, satsPerStx, times, timestamp } from "@/lib/format";
import { headline } from "@/lib/view";
import { site } from "@/lib/site";
import { ProvenanceTag } from "@/components/shared/provenance";
import readerLines from "@/data/reader-lines.json";

async function data() {
  const [cur, iv] = await Promise.all([getCurrent(), getIntervals()]);
  const intervals = iv?.intervals ?? [];
  const last = intervals.at(-1) ?? null;
  return { cur, intervals, last, h: headline(cur, last) };
}

const Unavailable = () => <span className="text-fd-muted-foreground">(live value unavailable)</span>;

type MetricName =
  | "coverage"
  | "headroom"
  | "obligation"
  | "reserve"
  | "cover"
  | "pending"
  | "apy"
  | "yieldPerStx"
  | "pool"
  | "cliff"
  | "sipCliff"
  | "friedger"
  | "price"
  | "distPrice";

/** Inline live figure: value, provenance tag, and where/when it was read. */
export async function Metric({ name }: { name: MetricName }) {
  const { cur, last, h } = await data();
  const block = cur ? `block ${int(cur.as_of.burn_height)}` : "";
  const dist = last ? `distribution ${last.distribution_index}` : "";
  const map: Record<MetricName, { v: string | null; p: "onchain" | "mirrored" | "hypothetical"; at: string }> = {
    coverage: { v: h.coverage.value == null ? null : times(h.coverage.value), p: h.coverage.provenance, at: h.coverage.provenance === "onchain" ? block : dist },
    headroom: { v: h.headroom.value == null ? null : pct(h.headroom.value), p: h.headroom.provenance, at: h.headroom.provenance === "onchain" ? block : dist },
    obligation: { v: h.obligation.value == null ? null : `${satsExact(h.obligation.value)} per interval`, p: h.obligation.provenance, at: h.obligation.provenance === "onchain" ? block : dist },
    reserve: { v: h.reserve.value == null ? null : `${btc(h.reserve.value)} (${satsExact(h.reserve.value)})`, p: h.reserve.provenance, at: h.reserve.provenance === "onchain" ? block : dist },
    cover: { v: h.cover.value == null ? null : `${h.cover.value.toFixed(2)} cycles`, p: h.cover.provenance, at: h.cover.provenance === "onchain" ? block : dist },
    pending: { v: h.pending.value == null ? null : satsExact(h.pending.value), p: "onchain", at: block },
    apy: { v: last?.stx_only_apy_btc.value == null ? null : pct(last.stx_only_apy_btc.value, 2), p: "mirrored", at: dist },
    yieldPerStx: { v: last?.stx_only_yield.value == null ? null : `${last.stx_only_yield.value.toFixed(4)} sats per STX`, p: "mirrored", at: dist },
    pool: { v: last ? satsExact(last.gross_pool.value) : null, p: "mirrored", at: dist },
    cliff: { v: cur?.cliff.price.value == null ? null : satsPerStx(cur.cliff.price.value), p: "mirrored", at: dist },
    sipCliff: { v: cur?.cliff.sip_book_scenario.value == null ? null : `≈ ${satsPerStx(cur.cliff.sip_book_scenario.value)}`, p: "hypothetical", at: dist },
    friedger: { v: cur?.cliff.friedger_sip_inputs.value == null ? null : satsPerStx(cur.cliff.friedger_sip_inputs.value), p: "hypothetical", at: "SIP launch inputs" },
    price: { v: cur?.price.value == null ? null : satsPerStx(cur.price.value, 2), p: "mirrored", at: block },
    distPrice: { v: last?.price.value == null ? null : `${satsPerStx(last.price.value, 2)} (${last.price.source})`, p: "mirrored", at: dist },
  };
  const m = map[name];
  if (!m.v) return <Unavailable />;
  return (
    <span className="whitespace-nowrap">
      <b className="font-semibold">{m.v}</b> <ProvenanceTag kind={m.p} className="align-middle" />{" "}
      <span className="text-xs text-fd-muted-foreground">({m.at})</span>
    </span>
  );
}

/** One-line note: when the live figures on a page were read. */
export async function AsOf() {
  const { cur, last } = await data();
  if (!cur) return null;
  return (
    <p className="text-sm text-fd-muted-foreground">
      Live figures on this page were read at Bitcoin block {int(cur.as_of.burn_height)} ({timestamp(cur.as_of.taken_at)}).
      {last && ` The latest distribution is ${last.distribution_index} (cycle ${last.cycle}, calculation height ${int(last.calculation_height)}).`}
    </p>
  );
}

/** Contract IDs with explorer links, from /api/meta. */
export async function Deployments() {
  const meta = await getMeta();
  const rows = [
    { name: "pox5-reader", net: "mainnet" as const, id: meta?.reader ?? null },
    { name: "risk-feed-trait", net: "mainnet" as const, id: meta?.trait.mainnet ?? null },
    { name: "coverage-cache", net: "mainnet" as const, id: meta?.cache ?? null },
    { name: "risk-feed", net: "testnet" as const, id: meta?.feed ?? null },
    { name: "risk-feed-trait", net: "testnet" as const, id: meta?.trait.testnet ?? null },
    { name: "coverage-guard-cached (example consumer)", net: "mainnet" as const, id: meta?.guard_mainnet ?? null },
    { name: "coverage-guard", net: "testnet" as const, id: meta?.guard ?? null },
    { name: "pox-5 (read by pox5-reader)", net: "mainnet" as const, id: meta?.pox5 ?? "SP000000000000000000002Q6VF78.pox-5" },
  ];
  return (
    <table>
      <thead>
        <tr>
          <th>Contract</th>
          <th>Network</th>
          <th>ID</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.name}-${r.net}`}>
            <td>{r.name}</td>
            <td>{r.net}</td>
            <td>
              {r.id ? (
                <a href={site.explorer(r.id, r.net)}>
                  <code>{r.id}</code>
                </a>
              ) : (
                "not deployed yet"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function trim(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.length > 2 && depth > 0 ? [...value.slice(0, 2).map((v) => trim(v, depth + 1)), `… ${value.length - 2} more`] : value.map((v) => trim(v, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trim(v, depth + 1)]));
  return value;
}

/** A live request/response example from the public API. */
export async function ApiExample({ path, pick, first }: { path: string; pick?: string; first?: boolean }) {
  const [res, cur] = await Promise.all([getPath<unknown>(path), getCurrent()]);
  if (!res) return <Unavailable />;
  let body: unknown = res;
  if (pick) body = pick.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], res);
  if (first && Array.isArray(body)) body = body.at(-1);
  return (
    <div className="my-4">
      <div className="rounded-t-lg border border-b-0 border-fd-border bg-fd-muted px-3 py-2 font-mono text-xs">
        GET {site.apiBase}
        {path}
        {cur ? <span className="text-fd-muted-foreground"> · read at block {int(cur.as_of.burn_height)}</span> : null}
      </div>
      <pre className="!mt-0 max-h-[28rem] overflow-auto rounded-t-none rounded-b-lg border border-fd-border bg-fd-card p-3 text-xs">
        <code>{JSON.stringify(trim(body), null, 2)}</code>
      </pre>
      {(pick || first) && (
        <p className="text-xs text-fd-muted-foreground">
          Showing {first ? "the latest item of " : ""}
          {pick ? <code>{pick}</code> : "the response"}; the full response has more fields.
        </p>
      )}
    </div>
  );
}

/** Recompute results for every distribution (the indexer's cross-check). */
export async function Recompute() {
  const { intervals } = await data();
  if (intervals.length === 0) return <Unavailable />;
  return (
    <table>
      <thead>
        <tr>
          <th>Distribution</th>
          <th>Cycle</th>
          <th>Gross pool</th>
          <th>Paid to bonds</th>
          <th>Reserve deposit</th>
          <th>Differences vs event</th>
          <th>Match</th>
        </tr>
      </thead>
      <tbody>
        {intervals.map((i) => (
          <tr key={i.distribution_index}>
            <td>
              <a href={site.explorer(i.txid, "mainnet")}>{i.distribution_index}</a>
            </td>
            <td>{i.cycle}</td>
            <td>{satsExact(i.gross_pool.value)}</td>
            <td>{satsExact(i.bond_paid.value)}</td>
            <td>{satsExact(i.reserve_deposit.value)}</td>
            <td>
              <code>{i.crosscheck.note.replace("diff vs event (sats): ", "")}</code>
            </td>
            <td>{i.crosscheck.ok ? "yes" : "no"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A live stress-test result for given query parameters. */
export async function Stress({ q, show }: { q: string; show: ("pool" | "coverage" | "shortfall" | "apy" | "payout")[] }) {
  const s = await getStress(q);
  if (!s) return <Unavailable />;
  const parts: string[] = [];
  if (show.includes("pool")) parts.push(`pool ${satsExact(s.pool.value)}`);
  if (show.includes("coverage")) parts.push(`coverage ${times(s.coverage.value)}`);
  if (show.includes("shortfall")) parts.push(`shortfall ${satsExact(s.shortfall.value)}`);
  if (show.includes("apy")) parts.push(`STX-only APY ${pct(s.stx_only_apy_btc.value, 2)}`);
  if (show.includes("payout")) parts.push(`bonds ${s.payout.value.map((b) => b.status).join(" / ")}`);
  return (
    <span>
      <b className="font-semibold">{parts.join(", ")}</b> <ProvenanceTag kind="hypothetical" className="align-middle" />{" "}
      <span className="text-xs text-fd-muted-foreground">
        (<code>/stress{q}</code>, base {s.inputs.base})
      </span>
    </span>
  );
}

/** Link to a pox5-reader function's line in the deployed source. */
export function Fn({ name }: { name: string }) {
  const line = (readerLines.lines as Record<string, number>)[name];
  const href = line ? `${site.repo}/blob/${readerLines.commit}/${readerLines.path}#L${line}` : undefined;
  return href ? (
    <a href={href}>
      <code>{name}</code>
    </a>
  ) : (
    <code>{name}</code>
  );
}

/** Link to a line of the deployed pox-5 source. */
export function Pox5({ lines, children }: { lines: string; children?: React.ReactNode }) {
  const [a, b] = lines.split("-");
  const href = `${site.repo}/blob/main/research/pox-5.deployed.clar#L${a}${b ? `-L${b}` : ""}`;
  return <a href={href}>{children ?? `pox-5 L${lines}`}</a>;
}
