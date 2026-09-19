// The logo, from its single source: web/brand/mark.json.
import mark from "@/brand/mark.json";

export const BRAND = {
  dark: { bg: "#07090c", ink: "#e9eef2", accent: "#26a596" },
  light: { bg: "#f7f6f2", ink: "#12161c", accent: "#008a7b" },
};

/** Inner SVG markup with colours filled in. Use "currentColor" / CSS vars for theme-aware UI. */
export const markInner = (ink: string, accent: string) => mark.svg.replaceAll("{ink}", ink).replaceAll("{accent}", accent);

/** A standalone SVG document of the mark (for favicons, OG images and exports). */
export function markSvg({ ink, accent, bg, size = 64, pad = 0 }: { ink: string; accent: string; bg?: string; size?: number; pad?: number }) {
  const [, , vw, vh] = mark.viewBox.split(" ").map(Number);
  const box = `${-pad} ${-pad} ${vw + pad * 2} ${vh + pad * 2}`;
  const rect = bg ? `<rect x="${-pad}" y="${-pad}" width="${vw + pad * 2}" height="${vh + pad * 2}" rx="${(vw + pad * 2) * 0.22}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${size}" height="${size}">${rect}${markInner(ink, accent)}</svg>`;
}

export const markDataUri = (opts: Parameters<typeof markSvg>[0]) =>
  `data:image/svg+xml;base64,${Buffer.from(markSvg(opts)).toString("base64")}`;

export { mark };
