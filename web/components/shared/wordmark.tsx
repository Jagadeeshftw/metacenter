import { cn } from "@/lib/utils";

// Placeholder mark until public/logo.svg exists: a circle with a load line.
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 26" fill="none" aria-hidden="true" className={cn("h-7 w-7", className)}>
      <circle cx="13" cy="13" r="11" stroke="currentColor" strokeWidth="2" />
      <line x1="2" y1="13" x2="24" y2="13" stroke="currentColor" strokeWidth="2" />
      <line x1="13" y1="5" x2="13" y2="13" stroke="var(--brand)" strokeWidth="2.4" />
    </svg>
  );
}

export function Wordmark({ hasLogo, className, compact }: { hasLogo: boolean; className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}>
      {hasLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo.svg" alt="" className="h-7 w-7" />
      ) : (
        <Mark />
      )}
      {!compact && <span>Metacenter</span>}
    </span>
  );
}
