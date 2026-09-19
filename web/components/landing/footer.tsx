import Link from "next/link";
import React from "react";
import { IconBrandGithub, IconBrandX } from "@tabler/icons-react";
import { Wordmark } from "@/components/shared/wordmark";
import { site } from "@/lib/site";

export function Footer({ reader, feed }: { reader: string | null; feed: string }) {
  const product = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Stress test", href: "/dashboard/stress" },
    { title: "Methodology", href: "/methodology" },
    { title: "Docs", href: "/docs" },
    { title: "API reference", href: "/api-reference" },
  ];
  const contracts = [
    ...(reader ? [{ title: "pox5-reader (mainnet)", href: site.explorer(reader, "mainnet") }] : []),
    { title: "risk-feed (testnet)", href: site.explorer(feed, "testnet") },
    { title: "pox-5 (mainnet)", href: site.explorer("SP000000000000000000002Q6VF78.pox-5", "mainnet") },
  ];
  const source = [
    { title: "GitHub", href: site.repo },
    { title: "Research data", href: `${site.repo}/tree/main/research` },
    { title: "MIT licence", href: `${site.repo}/blob/main/LICENSE` },
  ];
  const socials = [
    { title: "GitHub", href: site.repo, icon: IconBrandGithub },
    ...(site.xUrl ? [{ title: "X", href: site.xUrl, icon: IconBrandX }] : []),
  ];

  return (
    <footer className="relative border-t border-line px-8 py-20 bg-background w-full overflow-hidden mx-auto max-w-7xl">
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px flex h-8 items-end overflow-hidden">
        <div className="flex -mb-px h-[2px] w-56">
          <div className="w-full flex-none [background-image:linear-gradient(90deg,transparent_0%,var(--brand)_32.29%,color-mix(in_srgb,var(--brand)_30%,transparent)_67.19%,transparent_100%)] blur-xs" />
        </div>
      </div>
      <div className="max-w-7xl my-16 mx-auto text-sm text-muted flex flex-col justify-between md:px-8">
        <div className="flex flex-col md:flex-row justify-between gap-10">
          <div>
            <Link href="/" aria-label="Metacenter home">
              <Wordmark />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted">{site.description}</p>
            <div className="flex gap-3 mt-6">
              {socials.map((s) => (
                <a
                  key={s.title}
                  href={s.href}
                  aria-label={s.title}
                  className="w-11 h-11 rounded-full flex items-center justify-center border border-line text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
                >
                  <s.icon strokeWidth={1.5} width={18} height={18} />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-10 lg:gap-20">
            <FooterList title="Product" items={product} />
            <FooterList title="Contracts" items={contracts} />
            <FooterList title="Source" items={source} />
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-2 border-t border-line pt-8 text-xs text-subtle md:flex-row md:justify-between">
          <span>Independent project. Not affiliated with Stacks, Hiro or any integration named.</span>
          <span>Testnet feed values mirror mainnet data.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterList({ title, items }: { title: string; items: { title: string; href: string }[] }) {
  return (
    <div className="flex flex-col space-y-4">
      <p className="text-foreground font-semibold">{title}</p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.title}>
            <a href={item.href} className="hover:text-foreground transition-colors">
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
