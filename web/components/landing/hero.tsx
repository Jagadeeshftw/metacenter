"use client";
import React, { useRef } from "react";
import { motion, useMotionTemplate, useScroll, useTransform } from "motion/react";
import Balancer from "react-wrap-balancer";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Spotlight } from "@/components/ui/spotlight-new";
import { ProvenanceTag } from "@/components/shared/provenance";
import type { Provenance } from "@/lib/api";

export type HeroStat = { label: string; value: string; detail: string; provenance: Provenance };
export type HeroBar = { index: number; pool: number; owed: number };

export function Hero({ stats, bars, asOf }: { stats: HeroStat[]; bars: HeroBar[]; asOf: string }) {
  const parentRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const { scrollY } = useScroll({ target: parentRef });
  const translateY = useTransform(scrollY, [0, 100], [0, -20]);
  const scale = useTransform(scrollY, [0, 100], [1, 0.96]);
  const blurPx = useTransform(scrollY, [0, 150], [0, 5]);
  const filterBlurPx = useMotionTemplate`blur(${blurPx}px)`;
  const opacity = useTransform(scrollY, [0, 150], [1, 0]);

  return (
    <div
      ref={parentRef}
      id="home"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-28 md:px-8 md:pt-40 bg-background"
    >
      <Spotlight />
      <span className="relative z-20 mb-2 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-muted backdrop-blur">
        Risk feed for Stacks Bitcoin Staking (PoX-5)
      </span>
      <div className="text-balance relative z-20 mx-auto mb-4 mt-4 max-w-5xl text-center text-4xl font-semibold tracking-tight md:text-7xl">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ y: translateY, scale, filter: filterBlurPx, opacity }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-metal inline-block leading-[1.05]"
          >
            <Balancer>How far can the pool fall before bonds are short-paid?</Balancer>
          </motion.h1>
      </div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.5 }}
        className="relative z-20 mx-auto mt-4 max-w-xl px-4 text-center text-base/7 text-muted"
      >
        Metacenter measures PoX-5 bond coverage, the reserve and STX-only yield from public data, stress-tests them,
        and serves them to other contracts. Every figure says where it came from.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.7 }}
        className="mb-8 mt-6 sm:mb-10 sm:mt-8 flex w-full flex-col items-center justify-center gap-3 px-4 sm:px-8 sm:flex-row md:mb-20"
      >
        <Button as={Link} href="/dashboard" variant="primary" className="w-full sm:w-48 h-12 rounded-full">
          Open dashboard
        </Button>
        <Button as={Link} href="/methodology" variant="secondary" className="w-full sm:w-48 h-12 rounded-full">
          Read the methodology
        </Button>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.9, ease: "easeOut" }}
        className="relative mx-auto w-full max-w-6xl p-2 backdrop-blur-lg md:p-4"
      >
        <div className="relative rounded-[28px]">
          <GlowingEffect spread={60} glow={true} disabled={false} proximity={64} inactiveZone={0.01} borderWidth={3} blur={10} />
          <div
            className={cn(
              "relative grid gap-8 rounded-3xl border border-line p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:p-10",
              "[background:linear-gradient(180deg,var(--card-top),var(--card-bottom))]",
            )}
          >
            <MiniChart bars={bars} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 content-center">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col gap-1.5">
                  <span className="flex items-center justify-between gap-2 text-xs text-muted">
                    {s.label}
                    <ProvenanceTag kind={s.provenance} />
                  </span>
                  <span className="num text-[26px] sm:text-3xl md:text-5xl font-medium tracking-tight text-foreground whitespace-nowrap">{s.value}</span>
                  <span className="text-xs md:text-sm text-muted">{s.detail}</span>
                </div>
              ))}
            </div>
            <p className="num text-[11px] text-subtle md:col-span-2">{asOf}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function MiniChart({ bars }: { bars: HeroBar[] }) {
  if (bars.length === 0)
    return <div className="flex items-center justify-center text-sm text-muted">Live data unavailable right now.</div>;
  const W = 420;
  const H = 240;
  const base = 200;
  const top = 24;
  const max = Math.max(...bars.map((b) => b.pool)) * 1.1;
  const y = (v: number) => base - ((base - top) * v) / max;
  const slot = (W - 20) / bars.length;
  const bw = Math.min(46, slot * 0.6);
  const last = bars[bars.length - 1];
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-center justify-between text-xs text-muted">
        <span>Reward pool vs what bonds are owed, per distribution</span>
        <ProvenanceTag kind="mirrored" />
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Pool per distribution: ${bars.map((b) => `${b.index}: ${(b.pool / 1e6).toFixed(1)}M sats`).join(", ")}. Owed to bonds at ${last.index}: ${(last.owed / 1e6).toFixed(1)}M sats.`}>
        <line x1="0" x2={W} y1={base} y2={base} stroke="var(--border)" />
        {bars.map((b, i) => {
          const x = 10 + i * slot + (slot - bw) / 2;
          return (
            <g key={b.index}>
              <rect x={x} y={y(b.pool)} width={bw} height={base - y(b.pool)} rx="4" fill="var(--series-pool)" opacity={i === bars.length - 1 ? 1 : 0.55} />
              {b.owed > 0 && (
                <line x1={x - 8} x2={x + bw + 8} y1={y(b.owed)} y2={y(b.owed)} stroke="var(--series-owed)" strokeWidth="3" strokeLinecap="round" />
              )}
              <text x={x + bw / 2} y={base + 18} textAnchor="middle" fontSize="14" fill="var(--subtle)" className="num">
                {b.index}
              </text>
            </g>
          );
        })}
        <text x={10 + (bars.length - 1) * slot + slot / 2} y={y(last.pool) - 8} textAnchor="middle" fontSize="14" fill="var(--foreground)" className="num">
          {(last.pool / 1e6).toFixed(1)}M sats
        </text>
      </svg>
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-pool" />Pool (gross accrued)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-owed" />Owed to bonds{last.owed > 0 ? `: ${(last.owed / 1e6).toFixed(1)}M sats` : ""}</span>
      </div>
    </figure>
  );
}
