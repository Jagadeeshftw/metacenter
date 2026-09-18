"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, [query]);
  return matches;
}

// Cryptgen's pricing section, repurposed: the three ways to use Metacenter. All free.
type Way = {
  id: string;
  name: string;
  shortDescription: string;
  badge?: string;
  headline: string;
  period: string;
  features: string[];
  buttonText: string;
  href: string;
  subText: string;
};

export function Pricing({ reader, feed }: { reader: string | null; feed: string }) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const ways: Way[] = [
    {
      id: "dashboard",
      name: "Dashboard",
      shortDescription: "For stakers and anyone watching PoX-5",
      headline: "Web",
      period: "free, no sign-in",
      features: ["Coverage history and headroom", "Bond payout order", "Reserve and hypothetical cover", "Stress sliders"],
      buttonText: "Open dashboard",
      href: "/dashboard",
      subText: "Refreshed every ~10 minutes",
    },
    {
      id: "feed",
      name: "On-chain feed",
      shortDescription: "For Clarity contracts",
      badge: "FOR INTEGRATORS",
      headline: "Clarity",
      period: "risk-feed-trait",
      features: [
        reader ? `pox5-reader on mainnet: ${reader.split(".")[0].slice(0, 6)}…` : "pox5-reader on mainnet",
        `risk-feed on testnet: ${feed.split(".")[0].slice(0, 6)}…`,
        "get-coverage-summary for any consumer",
        "Example: coverage-guard pauses below 2.0×",
      ],
      buttonText: "Read the contracts",
      href: "/methodology#contracts",
      subText: "Testnet feed values mirror mainnet data",
    },
    {
      id: "api",
      name: "API",
      shortDescription: "For dashboards, bots and research",
      headline: "JSON",
      period: "read-only, free",
      features: ["/metrics/current and /intervals", "/stress with query parameters", "Every field carries its provenance", "Source function or event on every number"],
      buttonText: "API reference",
      href: "/api-reference",
      subText: "Same data the dashboard uses",
    },
  ];

  return (
    <div id="use" className="relative isolate w-full overflow-hidden px-4 py-16 md:py-40 pt-10 md:pt-60 lg:px-4 scroll-mt-24">
      {!isMobile && (
        <div className="pt-32 md:pt-48 mt-150">
          <BackgroundShape />
        </div>
      )}
      <div className={cn("z-20", isMobile ? "flex flex-col mt-0 relative" : "absolute inset-0 mt-80")}>
        <div className={cn("relative z-50 mx-auto mb-4", isMobile ? "w-full" : "max-w-4xl text-center")}>
          <h2 className="text-metal inline-block text-3xl md:text-6xl">Three ways to use it</h2>
        </div>
        <p className={cn("text-sm md:text-base text-muted mt-4 px-4", isMobile ? "w-full" : "max-w-lg text-center mx-auto")}>
          Read it, query it, or call it from a contract. All three serve the same numbers with the same labels.
        </p>
        <div className="mx-auto mt-12 md:mt-20 w-full px-4 py-8">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {ways.map((w) => (
              <WayCard way={w} key={w.id} />
            ))}
          </div>
        </div>
      </div>
      {!isMobile && (
        <div
          className="absolute inset-0 rounded-[20px] pointer-events-none"
          style={{ background: "linear-gradient(179.87deg, transparent 0.11%, color-mix(in srgb, var(--background) 80%, transparent) 69.48%, var(--background) 92.79%)" }}
        />
      )}
    </div>
  );
}

const WayCard = ({ way }: { way: Way }) => (
  <div className="relative z-10 flex flex-col rounded-3xl p-8 ring-1 ring-line [background:linear-gradient(180deg,var(--card-top),var(--card-bottom))] shadow-[0_24px_68px_var(--shadow)]">
    {way.badge && (
      <div className="text-center -mt-12 mb-6">
        <span className="text-xs tracking-wide px-4 py-1 rounded-full bg-foreground text-background shadow-[0px_2px_6.4px_0px_var(--shadow)]">
          {way.badge}
        </span>
      </div>
    )}
    <div className="mb-8">
      <div className="inline-flex items-center font-semibold justify-center p-2 rounded-[10px] border border-line">
        <h3 className="text-sm text-foreground">{way.name}</h3>
      </div>
      <p className="text-sm text-muted my-4">{way.shortDescription}</p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-5xl font-semibold text-foreground">{way.headline}</span>
        <span className="text-sm text-muted">{way.period}</span>
      </div>
    </div>
    <ul className="space-y-4 mb-8">
      {way.features.map((f) => (
        <li key={f} className="flex items-center gap-3">
          <IconCheck className="h-5 w-5 shrink-0 text-brand" />
          <span className="text-sm text-foreground/90">{f}</span>
        </li>
      ))}
    </ul>
    <div className="mt-auto">
      <Button as={Link} href={way.href} variant={way.badge ? "primary" : "secondary"} className="w-full h-12 rounded-xl">
        {way.buttonText}
      </Button>
      <p className="text-xs text-subtle text-center mt-4">{way.subText}</p>
    </div>
  </div>
);

function BackgroundShape() {
  const size = 1400;
  const innerSize = 1000;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line"
        style={{
          width: size,
          height: size,
          clipPath: "circle(50% at 50% 50%)",
          background: "radial-gradient(circle at center, var(--surface-2) 0%, var(--surface) 30%, var(--background) 70%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(var(--hatch) 1px, transparent 1px), linear-gradient(90deg, var(--hatch) 1px, transparent 1px)",
            backgroundSize: "60px 120px",
          }}
        />
      </div>
      <div
        className="absolute bg-background z-2 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line shadow-[0_0_200px_80px_var(--glow-1)]"
        style={{ width: innerSize, height: innerSize }}
      />
    </div>
  );
}
