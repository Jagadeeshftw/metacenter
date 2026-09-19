"use client";
// Dashboard app shell: collapsible sidebar (drawer on mobile) and a status top bar.
// No motion here by design; state changes are instant.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconApi,
  IconBook,
  IconBook2,
  IconBuildingBank,
  IconChartDots,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconListNumbers,
  IconMenu2,
  IconPercentage,
  IconAdjustmentsHorizontal,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/theme";
import { Wordmark } from "@/components/shared/wordmark";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: IconLayoutDashboard },
  { href: "/dashboard/coverage", label: "Coverage", icon: IconChartDots },
  { href: "/dashboard/bonds", label: "Bonds & payout order", icon: IconListNumbers },
  { href: "/dashboard/reserve", label: "Reserve", icon: IconBuildingBank },
  { href: "/dashboard/yield", label: "STX-only yield", icon: IconPercentage },
  { href: "/dashboard/stress", label: "Stress test", icon: IconAdjustmentsHorizontal },
  { href: "/methodology", label: "Methodology", icon: IconBook2 },
  { href: "/api-reference", label: "API", icon: IconApi },
  { href: "/docs", label: "Docs", icon: IconBook },
];

export type Status = { cycle: number | null; burnHeight: number | null; updated: string | null };

export function AppShell({ children, status }: { children: React.ReactNode; status: Status }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const path = usePathname();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("mc-sidebar") === "collapsed");
    } catch {}
  }, []);
  useEffect(() => setDrawer(false), [path]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("mc-sidebar", next ? "collapsed" : "open");
    } catch {}
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className={cn("hidden shrink-0 border-r border-line bg-surface lg:block", collapsed ? "w-[72px]" : "w-64")}>
      <aside className="sticky top-0 z-40 flex h-screen flex-col" aria-label="Sections">
        <div className={cn("flex h-16 items-center border-b border-line", collapsed ? "justify-center" : "px-5")}>
          <Link href="/" aria-label="Metacenter home">
            <Wordmark compact={collapsed} />
          </Link>
        </div>
        <SideNav path={path} collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("m-3 flex h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-foreground", collapsed && "justify-center")}
        >
          {collapsed ? <IconLayoutSidebarLeftExpand size={20} /> : <IconLayoutSidebarLeftCollapse size={20} />}
          {!collapsed && "Collapse"}
        </button>
      </aside>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Sections">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Link href="/" aria-label="Metacenter home">
                <Wordmark />
              </Link>
              <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="inline-flex h-11 w-11 items-center justify-center text-foreground">
                <IconX />
              </button>
            </div>
            <SideNav path={path} collapsed={false} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-background/90 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setDrawer(true)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-foreground lg:hidden"
            >
              <IconMenu2 size={20} />
            </button>
            <StatusBar status={status} />
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        <footer className="border-t border-line px-4 py-5 text-xs text-subtle md:px-8">
          Testnet feed values mirror mainnet data · every number links to its source on the Methodology page
        </footer>
      </div>
    </div>
  );
}

function SideNav({ path, collapsed }: { path: string; collapsed: boolean }) {
  return (
    <nav className="flex-1 overflow-y-auto p-3">
      <ul className="flex flex-col gap-1">
        {NAV.map((n) => {
          const active = n.href === "/dashboard" ? path === "/dashboard" : path.startsWith(n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                title={collapsed ? n.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm",
                  active ? "bg-brand-soft text-foreground font-medium" : "text-muted hover:bg-surface-2 hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <n.icon size={20} stroke={1.6} className={active ? "text-brand" : undefined} />
                {collapsed ? <span className="sr-only">{n.label}</span> : n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function StatusBar({ status }: { status: Status }) {
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden text-xs md:gap-4 md:text-sm">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-medium">
        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
        Mainnet
      </span>
      <span className="shrink-0 text-muted">
        Cycle <b className="num font-medium text-foreground">{status.cycle ?? "—"}</b>
      </span>
      <span className="hidden shrink-0 text-muted sm:inline">
        Bitcoin <b className="num font-medium text-foreground">{status.burnHeight?.toLocaleString("en-US") ?? "—"}</b>
      </span>
      <span className="hidden truncate text-muted md:inline">
        Last updated <b className="num font-medium text-foreground">{status.updated ?? "—"}</b>
      </span>
    </div>
  );
}
