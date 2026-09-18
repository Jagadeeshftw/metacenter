"use client";

import { cn } from "@/lib/utils";
import React from "react";
import { motion } from "motion/react";

// Cryptgen's testimonials section, repurposed: questions raised in the public Bitcoin Staking
// SIP discussion that these numbers answer. Quoted for context; they are not endorsements.
const THREAD = "https://forum.stacks.org/t/introducing-the-bitcoin-staking-sip-v1-draft/18862";

export function Testimonials() {
  return (
    <div className="w-full max-w-7xl mx-auto my-20 py-20 px-4 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-[40%]">
          <div className="sticky top-24">
            <h2 className="text-metal text-3xl text-center lg:text-left md:text-6xl leading-tight">
              The questions <br /> it answers
            </h2>
            <p className="text-sm text-center lg:text-left mx-auto lg:mx-0 text-muted mt-6 max-w-sm">
              From the public Bitcoin Staking SIP discussion on the Stacks forum. Quoted for context, not as endorsements
              of this project.
            </p>
            <a href={THREAD} className="mt-4 inline-block text-sm text-brand underline underline-offset-4">
              Read the thread
            </a>
          </div>
        </div>
        <div className="w-full grid gap-8 grid-cols-1 lg:grid-cols-2 md:w-[60%] mx-auto">
          <QuoteCard
            name="friedger"
            where="post #14"
            href={`${THREAD}/14`}
            quote="…make sure the contract exposes the coverage/fee data PoX-6 would need to parameterize this."
            answer="pox5-reader exposes obligation, coverage and headroom as read-only calls."
          />
          <QuoteCard
            name="friedger"
            where="post #14"
            href={`${THREAD}/14`}
            quote="What STX-only stackers (Tranche 2) can actually expect is highly price-dependent."
            answer="Realised STX-only yield per distribution, and a stress test for price and miner spend."
            className="lg:mt-12.5"
          />
          <QuoteCard
            name="PeaceLoveMusic.btc"
            where="post #15"
            href={`${THREAD}/15`}
            quote="That's not a tail risk. That's a one-third drawdown away from new bonds halted and the system running stressed."
            answer="Headroom shows how far the pool can fall before bond yield is impaired."
            className="lg:-mt-12.5"
          />
          <QuoteCard
            name="friedger"
            where="post #24"
            href={`${THREAD}/24`}
            quote="So we should assume that miners mine above the btc yield, e.g. 5%. That should be considered in the maths."
            answer="The stress test's miner-commit slider cuts the pool directly, independent of price."
          />
        </div>
      </div>
    </div>
  );
}

const QuoteCard = ({
  name,
  where,
  href,
  quote,
  answer,
  className,
}: {
  name: string;
  where: string;
  href: string;
  quote: string;
  answer: string;
  className?: string;
}) => (
  <motion.div
    whileHover={{ y: -5 }}
    className={cn(
      "flex flex-col min-h-96 p-8 rounded-[17px] border border-line relative isolate",
      "[background:linear-gradient(178deg,var(--card-top)_0.37%,var(--card-bottom)_38.61%)] shadow-[0_24px_68px_var(--shadow)]",
      className,
    )}
  >
    <div className="flex items-center gap-4 mb-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-line bg-surface-2 text-lg font-semibold text-foreground" aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div>
        <h3 className="text-xl font-semibold text-foreground">{name}</h3>
        <a href={href} className="text-sm text-muted underline-offset-4 hover:underline">
          Stacks forum, {where}
        </a>
      </div>
    </div>
    <p className="text-lg text-foreground/90 leading-relaxed">&ldquo;{quote}&rdquo;</p>
    <p className="mt-auto pt-6 text-sm text-brand">{answer}</p>
  </motion.div>
);
