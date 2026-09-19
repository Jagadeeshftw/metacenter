import { ImageResponse } from "next/og";
import { BRAND, markDataUri } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const src = markDataUri({ ink: BRAND.dark.ink, accent: BRAND.dark.accent, size: 120 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.dark.bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={120} height={120} alt="" />
      </div>
    ),
    size,
  );
}
