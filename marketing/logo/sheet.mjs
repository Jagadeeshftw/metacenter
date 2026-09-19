// Render the logo comparison sheet (marketing/logo/options.png) and per-option previews.
// options.png is the A–D sheet the logo was chosen from; build.mjs now defines only C, so
// rerunning this renders C alone (keep the committed options.png as the record). Outputs:
// favicon-16.png, favicon-32.png and avatar-400.png in each option's folder.
//   node marketing/logo/sheet.mjs <logoDir>
// Needs `playwright` (with CHROMIUM_PATH), `opentype.js` and `geist` resolvable from cwd.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { MARKS, markSvg, lockupSvg } from "./build.mjs";

const DIR = path.resolve(process.argv[2] ?? "marketing/logo");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

// Rasterise an SVG snippet at an exact pixel size.
async function raster(html, w, h, out, dpr = 1) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
}

const b64 = (file) => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
const svgUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

for (const id of Object.keys(MARKS)) {
  const d = path.join(DIR, id);
  const fav = markSvg(id, "dark", { background: true, size: 32 });
  await raster(`<img src="${svgUri(fav)}" width="16" height="16">`, 16, 16, path.join(d, "favicon-16.png"));
  await raster(`<img src="${svgUri(fav)}" width="32" height="32">`, 32, 32, path.join(d, "favicon-32.png"));
  // X avatar: the mark centred on the dark ground, with room for the circle crop
  const avatar = `<div style="width:400px;height:400px;background:#07090c;display:flex;align-items:center;justify-content:center"><img src="${svgUri(markSvg(id, "dark", { size: 232 }))}" width="232" height="232"></div>`;
  await raster(avatar, 400, 400, path.join(d, "avatar-400.png"));
}

const cell = (label, inner, bg, fg = "#8591a0") =>
  `<div class="cell" style="background:${bg}"><div class="inner">${inner}</div><div class="lab" style="color:${fg}">${label}</div></div>`;

const rows = Object.entries(MARKS)
  .map(([id, m]) => {
    const d = path.join(DIR, id);
    const pix = (file, n) => `<img src="${b64(path.join(d, file))}" width="${n}" height="${n}" style="image-rendering:pixelated">`;
    return `<section class="row">
      <div class="head"><span class="id">${id}</span><div><h2>${m.name}</h2><p>${m.note}</p></div></div>
      <div class="grid">
        ${cell("mark · dark", `<img src="${svgUri(markSvg(id, "dark", { size: 120 }))}" width="120">`, "#07090c")}
        ${cell("mark · light", `<img src="${svgUri(markSvg(id, "light", { size: 120 }))}" width="120">`, "#f7f6f2", "#5f6873")}
        ${cell("mark · single colour", `<img src="${svgUri(markSvg(id, "mono", { size: 120 }).replaceAll("currentColor", "#e9eef2"))}" width="120">`, "#1d2631")}
        ${cell("wordmark · dark", `<img src="${svgUri(lockupSvg(id, "dark"))}" height="52">`, "#07090c")}
        ${cell("wordmark · light", `<img src="${svgUri(lockupSvg(id, "light"))}" height="52">`, "#f7f6f2", "#5f6873")}
        ${cell("favicon 16 / 32 px (actual, then ×4)", `<div class="fav">${pix("favicon-16.png", 16)}${pix("favicon-32.png", 32)}${pix("favicon-16.png", 64)}${pix("favicon-32.png", 128)}</div>`, "#2a2f36")}
        ${cell("X avatar 400×400, circle crop", `<img src="${b64(path.join(d, "avatar-400.png"))}" width="150" height="150" style="border-radius:50%">`, "#15181d")}
      </div>
    </section>`;
  })
  .join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#0b0d11;color:#e9eef2;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
  .wrap{padding:40px 48px;width:1824px}
  h1{margin:0 0 6px;font-size:30px} .sub{margin:0 0 28px;color:#a9b4bf;font-size:15px}
  .row{border:1px solid #222c38;border-radius:18px;padding:22px;margin-bottom:22px;background:#0e1319}
  .head{display:flex;gap:18px;align-items:center;margin-bottom:16px}
  .id{font-size:44px;font-weight:700;color:#26a596;width:48px;text-align:center}
  h2{margin:0;font-size:20px} p{margin:4px 0 0;color:#a9b4bf;font-size:14px}
  .grid{display:grid;grid-template-columns:repeat(3,165px) 320px 320px 330px 210px;gap:12px}
  .cell{border-radius:12px;height:190px;display:flex;flex-direction:column;border:1px solid #222c38}
  .inner{flex:1;display:flex;align-items:center;justify-content:center;padding:10px}
  .lab{font-size:12px;padding:0 12px 10px}
  .fav{display:flex;align-items:flex-end;gap:14px}
</style></head><body><div class="wrap">
  <h1>Metacenter — logo options A–D</h1>
  <p class="sub">Concept: the metacentre, the point above a hull that decides whether it stays upright. Palette from the site: ink #e9eef2 / #12161c, teal #26a596 / #008a7b. Wordmark in Geist SemiBold, outlined.</p>
  ${rows}
</div></body></html>`;

const page = await browser.newPage({ viewport: { width: 1920, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.screenshot({ path: path.join(DIR, "options.png"), fullPage: true });
await browser.close();
console.log("wrote", path.join(DIR, "options.png"));
