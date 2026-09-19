import { ImageResponse } from "next/og";
import { BRAND, markDataUri } from "@/lib/brand";

export const alt = "Metacenter · risk feed for Stacks Bitcoin Staking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// OG and Twitter card, with the mark from web/brand/mark.json.
export default function OpenGraphImage() {
  const src = markDataUri({ ink: BRAND.dark.ink, accent: BRAND.dark.accent, size: 64 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BRAND.dark.bg, color: BRAND.dark.ink, padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={64} height={64} alt="" />
          <span style={{ fontSize: 44, fontWeight: 600 }}>Metacenter</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.05, maxWidth: 980 }}>How far can the pool fall before bonds are short-paid?</span>
          <span style={{ fontSize: 30, color: "#a9b4bf" }}>Bond coverage, reserve and STX-only yield for Stacks Bitcoin Staking (PoX-5) · metacenter.0xo.in</span>
        </div>
        <div style={{ display: "flex", height: 8, width: 240, background: BRAND.dark.accent, borderRadius: 4 }} />
      </div>
    ),
    size,
  );
}
