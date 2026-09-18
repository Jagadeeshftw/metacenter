"use client";
import React from "react";
import Balancer from "react-wrap-balancer";
import { motion } from "motion/react";

// Cryptgen's logo cloud, repurposed: the public sources every number is computed from.
// Text, not third-party logos, so nothing implies an affiliation.
const SOURCES = [
  { name: "pox-5", detail: "SP000…2Q6VF78.pox-5 read-only state" },
  { name: "calculate-rewards", detail: "one event per distribution" },
  { name: "Hiro API", detail: "v3 staking cycles, call-read ?tip=" },
  { name: "Bitcoin", detail: "miner commits to the sBTC address" },
];

export function SpotlightLogoCloud() {
  return (
    <div className="relative w-full py-12 md:py-20 overflow-hidden">
      <div className="text-balance relative z-20 mx-auto mb-4 max-w-4xl text-center text-lg font-semibold tracking-tight md:text-3xl px-4">
        <h2 className="text-metal inline-block">
          <Balancer>Built only on public data</Balancer>
        </h2>
      </div>
      <p className="text-center max-w-lg mx-auto text-base md:text-lg text-muted mt-4 mb-8 md:mb-10 px-4">
        No private feeds. Anyone can recompute every figure from these sources.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full max-w-4xl mx-auto relative px-4">
        {SOURCES.map((s, idx) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.08 }}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-line px-4 py-5 text-center [background:linear-gradient(180deg,var(--card-top),var(--card-bottom))]"
          >
            <span className="num text-base md:text-lg font-medium text-foreground">{s.name}</span>
            <span className="text-xs text-muted">{s.detail}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
