import { ImageResponse } from "next/og";
import { BRAND, markDataUri } from "@/lib/brand";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon from web/brand/mark.json.
export default function Icon() {
  const src = markDataUri({ ...BRAND.dark, size: 32, pad: 3 });
  // eslint-disable-next-line @next/next/no-img-element
  return new ImageResponse(<img src={src} width={32} height={32} alt="" />, size);
}
