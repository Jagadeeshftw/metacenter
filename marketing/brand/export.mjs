// Export X profile assets from the single logo source (web/brand/mark.json):
//   x-avatar-400.png   400×400, the mark centred on the dark ground (X crops it to a circle)
//   x-banner-1500x500.png  dark, logo + one-line tagline + URL
//   web/app/favicon.ico    16/32/48, same padding and ground as web/app/icon.tsx, for clients
//                          that request /favicon.ico directly
//
//   node marketing/brand/export.mjs <outDir>
// Needs `playwright` resolvable from cwd, CHROMIUM_PATH, and GEIST_DIR pointing at the
// `geist` package's font folder (dist/fonts/geist-sans) for the wordmark.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.REPO_ROOT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, "marketing", "brand"));
const mark = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "brand", "mark.json"), "utf8"));
const GEIST = process.env.GEIST_DIR;
const C = { bg: "#07090c", ink: "#e9eef2", muted: "#a9b4bf", accent: "#26a596" };

const svg = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}" width="${size}" height="${size}">${mark.svg
    .replaceAll("{ink}", C.ink)
    .replaceAll("{accent}", C.accent)}</svg>`;
// matches markSvg({ ...BRAND.dark, pad: 3 }) in web/lib/brand.ts
const tile = (size, pad = 3) => {
  const [, , vw] = mark.viewBox.split(" ").map(Number);
  const w = vw + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${w} ${w}" width="${size}" height="${size}"><rect x="${-pad}" y="${-pad}" width="${w}" height="${w}" rx="${w * 0.22}" fill="${C.bg}"/>${mark.svg
    .replaceAll("{ink}", C.ink)
    .replaceAll("{accent}", C.accent)}</svg>`;
};
// ICO container holding PNG images (supported by every current browser)
const ico = (pngs) => {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(([size, buf], i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size % 256, e);
    head.writeUInt8(size % 256, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([head, ...pngs.map(([, buf]) => buf)]);
};
const font = (weight, file) =>
  GEIST ? `@font-face{font-family:Geist;font-weight:${weight};src:url("file://${path.join(GEIST, file)}")}` : "";
const css = `${font(400, "Geist-Regular.ttf")}${font(600, "Geist-SemiBold.ttf")}
  body{margin:0;background:${C.bg};color:${C.ink};font-family:Geist,ui-sans-serif,system-ui,sans-serif}`;

const avatar = `<html><head><style>${css}</style></head><body>
  <div style="width:400px;height:400px;display:flex;align-items:center;justify-content:center">${svg(232)}</div>
</body></html>`;

const banner = `<html><head><style>${css}
  .b{width:1500px;height:500px;position:relative;overflow:hidden;display:flex;align-items:center}
  .glow{position:absolute;border-radius:50%}
</style></head><body><div class="b">
  <div class="glow" style="left:-260px;top:-420px;width:1000px;height:1000px;background:radial-gradient(closest-side,rgba(38,165,150,.22),rgba(38,165,150,0) 100%)"></div>
  <div class="glow" style="right:-300px;bottom:-500px;width:900px;height:900px;background:radial-gradient(closest-side,rgba(189,132,32,.10),rgba(7,9,12,0) 100%)"></div>
  <!-- keep clear of the avatar, which X overlaps at the bottom left -->
  <div style="position:relative;margin-left:520px;display:flex;flex-direction:column;gap:22px">
    <div style="display:flex;align-items:center;gap:22px">${svg(84)}<span style="font-size:68px;font-weight:600;letter-spacing:-0.02em">Metacenter</span></div>
    <div style="font-size:30px;color:${C.muted}">Open risk feed for Stacks Bitcoin Staking (PoX-5)</div>
    <div style="font-size:26px;color:${C.accent};font-weight:600">metacenter.0xo.in</div>
  </div>
</div></body></html>`;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const [name, html, w, h] of [
  ["x-avatar-400.png", avatar, 400, 400],
  ["x-banner-1500x500.png", banner, 1500, 500],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  console.log("wrote", path.join(OUT, name), `(mark: ${mark.id})`);
}
const pngs = [];
for (const size of [16, 32, 48]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${tile(size)}</body></html>`);
  pngs.push([size, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })]);
  await page.close();
}
const icoPath = path.join(ROOT, "web", "app", "favicon.ico");
fs.writeFileSync(icoPath, ico(pngs));
console.log("wrote", icoPath, `(mark: ${mark.id}, 16/32/48)`);
await browser.close();
