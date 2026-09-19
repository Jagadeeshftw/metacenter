"use client";

import { cn } from "@/lib/utils";
import React from "react";
import { motion } from "motion/react";

// Cryptgen's testimonials section, repurposed: questions raised in the public Bitcoin Staking
// SIP discussion that these numbers answer. Quoted verbatim for context; they are not
// endorsements. Each quote was checked against the thread (post number, author, wording).
const THREAD = "https://forum.stacks.org/t/introducing-the-bitcoin-staking-sip-v1-draft/18862";

type Quote = { name: string; post: number; quote: string; answer: string };

const QUOTES: Quote[] = [
  {
    name: "friedger",
    post: 14,
    quote: "…make sure the contract exposes the coverage/fee data PoX-6 would need to parameterize this.",
    answer: "pox5-reader exposes obligation, coverage and headroom as read-only calls.",
  },
  {
    name: "PeaceLoveMusic.btc",
    post: 15,
    quote: "That’s not a tail risk. That’s a one-third drawdown away from new bonds halted and the system running stressed.",
    answer: "Headroom shows how far the pool can fall before bond yield is impaired.",
  },
  {
    name: "alexlmiller",
    post: 42,
    quote: "The reserve remains accrual-only during PoX-5, and disbursement remains possible only through consensus.",
    answer: "The reserve is shown as hypothetical cover: it grows, but pox-5 cannot pay bonds from it.",
  },
  {
    name: "friedger",
    post: 24,
    quote: "So we should assume that miners mine above the btc yield, e.g. 5%. That should be considered in the maths",
    answer: "The stress test’s miner-commit slider cuts the pool directly, independent of price.",
  },
];

export function Testimonials() {
  const left = QUOTES.filter((_, i) => i % 2 === 0);
  const right = QUOTES.filter((_, i) => i % 2 === 1);
  return (
    <section className="mx-auto my-16 w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <h2 className="bg-gradient-to-r from-foreground via-foreground to-[var(--metal-b)] bg-clip-text text-center text-3xl leading-tight text-transparent md:text-5xl lg:text-left lg:text-6xl">
            The questions it answers
          </h2>
          <p className="mx-auto mt-6 max-w-md text-center text-sm text-muted lg:mx-0 lg:text-left md:text-base">
            From the public Bitcoin Staking SIP discussion on the Stacks forum. Quoted verbatim for context, not as
            endorsements of this project.
          </p>
          <p className="mt-4 text-center lg:text-left">
            <a href={THREAD} className="text-sm text-brand underline underline-offset-4">
              Read the thread
            </a>
          </p>
        </div>
        {/* two columns with equal gaps (one between lg and xl, where the text column takes space);
            the right one sits a fixed step lower for a deliberate stagger */}
        <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6">
            {left.map((q) => (
              <QuoteCard key={`${q.name}-${q.post}`} {...q} />
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-6 sm:pt-12 lg:pt-0 xl:pt-12">
            {right.map((q) => (
              <QuoteCard key={`${q.name}-${q.post}`} {...q} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const QuoteCard = ({ name, post, quote, answer, className }: Quote & { className?: string }) => (
  <motion.figure
    whileHover={{ y: -5 }}
    className={cn(
      "relative isolate flex flex-col rounded-[17px] border border-line p-6 md:p-7",
      "[background:linear-gradient(178deg,var(--card-top)_0.37%,var(--card-bottom)_38.61%)] shadow-[0_24px_68px_var(--shadow)]",
      className,
    )}
  >
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface-2 text-base font-semibold text-foreground" aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <figcaption className="min-w-0">
        <div className="truncate text-lg font-semibold text-foreground">{name}</div>
        <a href={`${THREAD}/${post}`} className="text-sm text-muted underline-offset-4 hover:underline">
          Stacks forum, post #{post}
        </a>
      </figcaption>
    </div>
    <blockquote cite={`${THREAD}/${post}`} className="mt-5 text-base leading-relaxed text-foreground/90 md:text-lg">
      &ldquo;{quote}&rdquo;
    </blockquote>
    <p className="mt-5 border-t border-line pt-4 text-sm text-brand">{answer}</p>
  </motion.figure>
);
