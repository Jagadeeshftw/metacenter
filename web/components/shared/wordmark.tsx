import { cn } from "@/lib/utils";
import mark from "@/brand/mark.json";

// The mark, from web/brand/mark.json: ink follows the text colour, the accent the brand colour.
const inner = mark.svg.replaceAll("{ink}", "currentColor").replaceAll("{accent}", "var(--brand)");

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox={mark.viewBox} fill="none" aria-hidden="true" className={cn("h-7 w-7", className)} dangerouslySetInnerHTML={{ __html: inner }} />
  );
}

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}>
      <Mark />
      {!compact && <span>Metacenter</span>}
    </span>
  );
}
