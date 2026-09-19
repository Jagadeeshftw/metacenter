// Build the Metacenter logo options (A–D) as SVG files.
//   node marketing/logo/build.mjs <outDir>
// Needs `opentype.js` and the `geist` font package resolvable from the working directory
// (the wordmark is outlined to paths, so the SVGs do not depend on installed fonts).
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

const OUT = path.resolve(process.argv[2] ?? "marketing/logo");
const ttf = fs.readFileSync(
  process.env.GEIST_TTF ?? path.join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf"),
);
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));

// Site palette (web/app/globals.css)
export const THEMES = {
  dark: { bg: "#07090c", ink: "#e9eef2", accent: "#26a596" },
  light: { bg: "#f7f6f2", ink: "#12161c", accent: "#008a7b" },
  mono: { bg: "none", ink: "currentColor", accent: "currentColor" },
};

// Marks on a 32×32 grid. `i` = ink, `a` = accent (the metacentre point).
export const MARKS = {
  A: {
    name: "Hull & metacentre",
    note: "A solid hull with the metacentre point above it. The most literal; strongest at 16 px.",
    svg: (i, a) =>
      `<path d="M4 15.5H28A12 12 0 0 1 4 15.5Z" fill="${i}"/><circle cx="16" cy="7" r="3.4" fill="${a}"/>`,
  },
  B: {
    name: "Hull, mast & point",
    note: "An open hull section with a mast rising to the metacentre. Reads as a stability diagram.",
    svg: (i, a) =>
      `<path d="M5 11V15.5A11 11 0 0 0 27 15.5V11" fill="none" stroke="${i}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="M16 24.5V12" stroke="${i}" stroke-width="3.2" stroke-linecap="round"/><circle cx="16" cy="6.2" r="3.3" fill="${a}"/>`,
  },
  C: {
    name: "M monogram",
    note: "An M whose centre dips like a keel, with the point above it. Doubles as the initial.",
    svg: (i, a) =>
      `<path d="M5.5 25V9.5L16 20.5L26.5 9.5V25" fill="none" stroke="${i}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="16" cy="7.4" r="3.2" fill="${a}"/>`,
  },
  D: {
    name: "Heeling hull, upright line",
    note: "The hull heels 14° while the line to the metacentre stays vertical: the righting idea, without a ring.",
    svg: (i, a) =>
      `<g transform="rotate(-14 16 19)"><path d="M5 18H27A11 11 0 0 1 5 18Z" fill="${i}"/></g>` +
      `<path d="M16 17V11.5" stroke="${i}" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="6.5" r="3.3" fill="${a}"/>`,
  },
};

const wordPath = (x, baseline, size) => {
  const p = font.getPath("Metacenter", x, baseline, size, { kerning: true, letterSpacing: -0.02 });
  return { d: p.toPathData(2), width: font.getAdvanceWidth("Metacenter", size, { kerning: true, letterSpacing: -0.02 }) };
};

export function markSvg(id, theme, { size = 32, background = false } = {}) {
  const t = THEMES[theme];
  const bg = background && t.bg !== "none" ? `<rect width="32" height="32" rx="7" fill="${t.bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">${bg}${MARKS[id].svg(t.ink, t.accent)}</svg>`;
}

export function lockupSvg(id, theme) {
  const t = THEMES[theme];
  const w = wordPath(42, 23.2, 21);
  const width = Math.ceil(42 + w.width + 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 32" width="${width * 4}" height="128">${MARKS[id].svg(t.ink, t.accent)}<path d="${w.d}" fill="${t.ink}"/></svg>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const id of Object.keys(MARKS)) {
    const dir = path.join(OUT, id);
    fs.mkdirSync(dir, { recursive: true });
    for (const theme of Object.keys(THEMES)) {
      fs.writeFileSync(path.join(dir, `mark-${theme}.svg`), markSvg(id, theme, { size: 256 }));
      fs.writeFileSync(path.join(dir, `lockup-${theme}.svg`), lockupSvg(id, theme));
    }
    fs.writeFileSync(path.join(dir, "favicon.svg"), markSvg(id, "dark", { size: 32, background: true }));
  }
  console.log("wrote", Object.keys(MARKS).join(", "), "to", OUT);
}
