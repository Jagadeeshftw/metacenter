import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const alt = "Metacenter · risk feed for Stacks Bitcoin Staking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Uses public/logo.png once it exists; the text wordmark mark until then.
export default function OpenGraphImage() {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const logo = fs.existsSync(logoPath) ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}` : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#07090c", color: "#e9eef2", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={64} height={64} alt="" />
          ) : (
            <svg width="64" height="64" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="11" stroke="#e9eef2" strokeWidth="2" />
              <line x1="2" y1="13" x2="24" y2="13" stroke="#e9eef2" strokeWidth="2" />
              <line x1="13" y1="5" x2="13" y2="13" stroke="#26a596" strokeWidth="2.4" />
            </svg>
          )}
          <span style={{ fontSize: 44, fontWeight: 600 }}>Metacenter</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.05, maxWidth: 980 }}>How far can the pool fall before bonds are short-paid?</span>
          <span style={{ fontSize: 30, color: "#a9b4bf" }}>Bond coverage, reserve and STX-only yield for Stacks Bitcoin Staking (PoX-5)</span>
        </div>
        <div style={{ display: "flex", height: 8, width: 240, background: "#26a596", borderRadius: 4 }} />
      </div>
    ),
    size,
  );
}
