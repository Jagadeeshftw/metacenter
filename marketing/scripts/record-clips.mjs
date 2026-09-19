// Record short marketing clips from the LIVE site (dark theme, real data only).
//
//   node record-clips.mjs <outDir> [--resolve <ip>] [--only a,b,...]
//
// Frames come from Chrome's screencast at devicePixelRatio 2 (1280×720 CSS viewport,
// 2560×1440 frames), so cropping to a panel stays sharp. Each clip is encoded twice with
// ffmpeg: 1280×720 and 1080×1080, H.264, 30 fps, no audio: 6 s of footage with a small
// logo watermark bottom-right, then a 1 s end card (logo + metacenter.0xo.in), 7 s total.
// The logo comes from web/brand/mark.json (the single logo asset). A still PNG of each
// crop is saved at the clip's key moment (no watermark). Needs `playwright` resolvable from the working
// directory, CHROMIUM_PATH pointing at a Chromium build, and ffmpeg on PATH.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://metacenter.0xo.in";
let W = 1280, H = 720;
const DPR = 2, DURATION = 6, FPS = 30;
const argv = process.argv.slice(2);
const OUT = path.resolve(argv[0] ?? "clips");
const ip = argv.includes("--resolve") ? argv[argv.indexOf("--resolve") + 1] : null;
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : null;
fs.mkdirSync(OUT, { recursive: true });
const ROOT = process.env.REPO_ROOT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MARK = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "brand", "mark.json"), "utf8"));
const GEIST = process.env.GEIST_DIR; // optional: geist/dist/fonts/geist-sans for the end card
const END_CARD = 1; // seconds

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  // without this flag the screencast delivers CSS-size frames regardless of deviceScaleFactor
  args: [`--force-device-scale-factor=${DPR}`, ...(ip ? [`--host-resolver-rules=MAP metacenter.0xo.in ${ip}`] : [])],
});

// ---------- brand overlays (watermark + end card), rendered once per output size ----------
const markSvg = (size, ink = "#e9eef2", accent = "#26a596") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK.viewBox}" width="${size}" height="${size}">${MARK.svg.replaceAll("{ink}", ink).replaceAll("{accent}", accent)}</svg>`;
const fontCss = GEIST ? `@font-face{font-family:Geist;font-weight:600;src:url("file://${path.join(GEIST, "Geist-SemiBold.ttf")}")}@font-face{font-family:Geist;font-weight:400;src:url("file://${path.join(GEIST, "Geist-Regular.ttf")}")}` : "";
const BRAND_DIR = path.join(OUT, ".brand");
fs.mkdirSync(BRAND_DIR, { recursive: true });
async function renderPng(html, w, h, file, transparent = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<html><head><style>${fontCss}body{margin:0;background:${transparent ? "transparent" : "#07090c"};font-family:Geist,ui-sans-serif,system-ui,sans-serif}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
}
const BRAND = {};
for (const [key, w, h, wm] of [["1280x720", 1280, 720, 40], ["1080x1080", 1080, 1080, 52]]) {
  const water = path.join(BRAND_DIR, `watermark-${key}.png`);
  await renderPng(`<div style="width:${wm}px;height:${wm}px;opacity:.8">${markSvg(wm)}</div>`, wm, wm, water, true);
  const end = path.join(BRAND_DIR, `endcard-${key}.png`);
  const big = Math.round(Math.min(w, h) * 0.2);
  await renderPng(
    `<div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(big * 0.28)}px;color:#e9eef2;background:radial-gradient(closest-side at 50% 42%,rgba(38,165,150,.18),rgba(7,9,12,0) 70%),#07090c">
      <div style="display:flex;align-items:center;gap:${Math.round(big * 0.22)}px">${markSvg(big)}<span style="font-size:${Math.round(big * 0.62)}px;font-weight:600;letter-spacing:-0.02em">Metacenter</span></div>
      <div style="font-size:${Math.round(big * 0.3)}px;color:#26a596;font-weight:600">metacenter.0xo.in</div>
    </div>`,
    w, h, end,
  );
  BRAND[key] = { water, end };
}

// ---------- helpers ----------
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let mouse = { x: W / 2, y: H / 2 };
async function glide(page, x, y, ms = 900) {
  const from = { ...mouse };
  const steps = Math.max(2, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
    await page.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
    await page.waitForTimeout(16);
  }
  mouse = { x, y };
}
const box = async (loc) => {
  const b = await loc.boundingBox();
  if (!b) throw new Error("element not visible");
  return b;
};
const centerOf = (b) => [b.x + b.width / 2, b.y + b.height / 2];
const union = (...bs) => {
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  return { x, y, width: Math.max(...bs.map((b) => b.x + b.width)) - x, height: Math.max(...bs.map((b) => b.y + b.height)) - y };
};
// Expand a focus rect (CSS px) to an aspect ratio, pad it, keep it inside the viewport.
function fit(r, aspect, pad = 24, minW = 560) {
  let w = r.width + pad * 2, h = r.height + pad * 2;
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  if (w < minW) { w = minW; h = w / aspect; }
  if (w > W) { w = W; h = w / aspect; }
  if (h > H) { h = H; w = h * aspect; }
  let x = r.x + r.width / 2 - w / 2, y = r.y + r.height / 2 - h / 2;
  x = Math.max(0, Math.min(W - w, x));
  y = Math.max(0, Math.min(H - h, y));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  await ctx.addInitScript(() => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem("mc-sidebar", "open");
    const add = () => {
      if (document.getElementById("__cursor")) return;
      const c = document.createElement("div");
      c.id = "__cursor";
      Object.assign(c.style, {
        position: "fixed", left: "50%", top: "50%", width: "20px", height: "20px", marginLeft: "-10px", marginTop: "-10px",
        borderRadius: "50%", border: "2px solid #fff", background: "rgba(38,165,150,0.55)", zIndex: "2147483647",
        pointerEvents: "none", boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
      });
      document.body.appendChild(c);
      addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    };
    if (document.readyState === "loading") addEventListener("DOMContentLoaded", add); else add();
  });
  const page = await ctx.newPage();
  mouse = { x: W / 2, y: H / 2 };
  return { ctx, page };
}

// Capture screencast frames (with timestamps) while `act` runs.
async function capture(page, act) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    // only full-viewport frames (anything else is a transient resize)
    if (f.metadata.deviceWidth === W && f.metadata.deviceHeight === H) frames.push({ ts: f.metadata.timestamp, data: f.data });
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch {}
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 94, maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  await act();
  await page.waitForTimeout(150);
  await cdp.send("Page.stopScreencast");
  return { frames, t0 };
}

function encode(name, { frames, t0 }, crops, snapAt) {
  const dir = path.join(OUT, `.frames-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  const start = Math.max(t0, frames[0].ts);
  const kept = frames.filter((f) => f.ts >= start - 0.001);
  const lines = ["ffconcat version 1.0"];
  kept.forEach((f, i) => {
    const file = `f${String(i).padStart(5, "0")}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(f.data, "base64"));
    const next = i + 1 < kept.length ? kept[i + 1].ts : start + DURATION + 0.5;
    lines.push(`file '${file}'`, `duration ${Math.max(0.001, next - f.ts).toFixed(4)}`);
  });
  lines.push(`file 'f${String(kept.length - 1).padStart(5, "0")}.jpg'`);
  fs.writeFileSync(path.join(dir, "list.ffconcat"), lines.join("\n"));
  // still: the last frame shown at or before the key moment
  const at = snapAt ?? kept.at(-1).ts;
  const si = Math.max(0, kept.findLastIndex((f) => f.ts <= at));
  const stillSrc = path.join(dir, `f${String(si).padStart(5, "0")}.jpg`);
  for (const [suffix, c, outW, outH] of crops) {
    const crop = `crop=${c.w * DPR}:${c.h * DPR}:${c.x * DPR}:${c.y * DPR},scale=${outW}:${outH}:flags=lanczos`;
    const out = path.join(OUT, `${name}-${suffix}.mp4`);
    const b = BRAND[suffix];
    const graph =
      `[0:v]${crop},fps=${FPS},format=yuv420p,trim=duration=${DURATION},setpts=PTS-STARTPTS[main];` +
      `[main][1:v]overlay=W-w-28:H-h-24:format=auto[wm];` +
      `[2:v]scale=${outW}:${outH},fps=${FPS},format=yuv420p,trim=duration=${END_CARD},setpts=PTS-STARTPTS[end];` +
      `[wm][end]concat=n=2:v=1:a=0,format=yuv420p[out]`;
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.ffconcat"),
      "-i", b.water,
      "-loop", "1", "-t", String(END_CARD + 0.5), "-i", b.end,
      "-filter_complex", graph, "-map", "[out]",
      "-t", String(DURATION + END_CARD), "-r", String(FPS),
      "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", "-an", out,
    ]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", stillSrc, "-vf", crop, "-frames:v", "1", path.join(OUT, `${name}-${suffix}.png`)]);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

// Record one clip: `setup` prepares the page and returns the focus rect; `act(snap)` runs
// for ~6 s and calls snap() at the key moment for the stills.
// Each clip is recorded twice: in a 1280×720 viewport for the landscape version, and in a
// 760×760 viewport for the square one, so the site reflows to its narrower layout instead
// of being cropped at the edges.
async function clip(name, setup, act, viewport = { width: 1280, height: 720 }) {
  if (only && !only.includes(name[0])) return;
  const variants = [
    { suffix: "1280x720", vp: viewport, aspect: 16 / 9, outW: 1280, outH: 720 },
    { suffix: "1080x1080", vp: { width: 760, height: 760 }, aspect: 1, outW: 1080, outH: 1080 },
  ];
  const report = [];
  for (const v of variants) {
    W = v.vp.width;
    H = v.vp.height;
    const { ctx, page } = await newPage();
    try {
      const focus = await setup(page);
      const crop = fit(focus, v.aspect, 24, v.aspect === 1 ? 480 : 560);
      let snapAt = null;
      // mark the key moment; the still is cut from the recorded frame at that time
      const snap = async () => { snapAt ??= Date.now() / 1000; };
      const cap = await capture(page, async () => {
        await act(page, snap);
      });
      // screencast timestamps are wall-clock seconds, like Date.now()
      encode(name, cap, [[v.suffix, crop, v.outW, v.outH]], snapAt);
      report.push(`${v.suffix} ${cap.frames.length} frames ${(fs.statSync(path.join(OUT, `${name}-${v.suffix}.mp4`)).size / 1e6).toFixed(1)} MB`);
    } finally {
      await ctx.close();
    }
  }
  console.log(`${name}: ${report.join(" · ")}`);
}

const settle = (page) => page.waitForLoadState("networkidle").catch(() => {});
const scrollTo = async (page, loc, top = 72) => {
  const b = await box(loc);
  await page.evaluate((dy) => window.scrollBy(0, dy), b.y - top);
  await page.waitForTimeout(400);
};

// ---------- clips ----------

// a. landing hero with motion → "Open dashboard"
await clip(
  "a-landing-hero",
  async (page) => {
    // dark placeholder so the clip never opens on a white page
    await page.goto("data:text/html,<body style='margin:0;background:%2307090c'></body>");
    return { x: 0, y: 0, width: W, height: H };
  },
  async (page, snap) => {
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);
    await snap();
    const btn = page.locator("#home").getByRole("link", { name: "Open dashboard" }).first();
    await glide(page, ...centerOf(await box(btn)), 800);
    await page.waitForTimeout(200);
    await btn.click();
    await page.waitForURL("**/dashboard");
    await page.waitForTimeout(1500);
  },
);

// b. headroom + coverage cards, hovering the provenance tag
await clip(
  "b-headroom-coverage",
  async (page) => {
    await page.goto(`${SITE}/dashboard`);
    await settle(page);
    const cards = page.locator("section[aria-label='Headline figures'] > div");
    await scrollTo(page, cards.nth(0), 170);
    const b = union(await box(cards.nth(0)), await box(cards.nth(1)));
    // include the space above the cards, where the provenance tooltip opens
    return { x: b.x, y: b.y - 90, width: b.width, height: b.height + 90 };
  },
  async (page, snap) => {
    const cards = page.locator("section[aria-label='Headline figures'] > div");
    const head = await box(cards.nth(0));
    await glide(page, head.x + head.width * 0.3, head.y + head.height * 0.45, 700);
    await page.waitForTimeout(700);
    const tag = page.locator("section[aria-label='Headline figures'] [role='tooltip']").first().locator("..");
    await glide(page, ...centerOf(await box(tag)), 1000);
    await page.waitForTimeout(1500);
    await snap();
    const cov = await box(cards.nth(1));
    await glide(page, cov.x + cov.width * 0.4, cov.y + cov.height * 0.45, 900);
    await page.waitForTimeout(1300);
  },
);

// c. coverage history with tooltip and the 2.0× target line
await clip(
  "c-coverage-history",
  async (page) => {
    await page.goto(`${SITE}/dashboard/coverage`);
    await settle(page);
    const panel = page.locator("section").filter({ has: page.getByRole("heading", { name: "Coverage per distribution" }) }).first();
    await scrollTo(page, panel, 80);
    return box(panel);
  },
  async (page, snap) => {
    const svg = await box(page.locator("svg[aria-label^='Coverage per distribution']").first());
    await glide(page, svg.x + svg.width * 0.25, svg.y + svg.height * 0.5, 900);
    await page.waitForTimeout(1200);
    await glide(page, svg.x + svg.width * 0.8, svg.y + svg.height * 0.3, 1200);
    await page.waitForTimeout(1600);
    await snap();
    await page.waitForTimeout(1000);
  },
);

// d. stress test: miner-commit drop 0 → 50%, coverage falling live
const stressFocus = async (page) => {
  await page.goto(`${SITE}/dashboard/stress`);
  await settle(page);
  const controls = page.locator("section").filter({ has: page.locator("input[type=range]") }).first();
  await scrollTo(page, controls, 80);
  const outputs = page.locator("section").filter({ hasText: "Pool per interval" }).first();
  return union(await box(controls), await box(outputs));
};
await clip("d-stress-commit-drop", stressFocus, async (page, snap) => {
  const slider = page.locator("input[type=range]").first();
  const b = await box(slider);
  const at = (p) => b.x + 10 + ((b.width - 20) * p) / 100;
  await glide(page, at(0), b.y + b.height / 2, 700);
  await slider.focus();
  for (let p = 5; p <= 50; p += 5) {
    for (let k = 0; k < 5; k++) await slider.press("ArrowRight");
    await glide(page, at(p), b.y + b.height / 2, 60);
    await page.waitForTimeout(290);
  }
  await page.waitForTimeout(1300);
  await snap();
  await page.waitForTimeout(400);
});

// e. stress test: switch the book to the hypothetical 3,000 BTC book
await clip(
  "e-stress-3000btc-book",
  async (page) => {
    await page.goto(`${SITE}/dashboard/stress`);
    await settle(page);
    const outputs = page.locator("section").filter({ hasText: "Pool per interval" }).first();
    const hyp = page.getByRole("radio", { name: "Hypothetical" });
    await scrollTo(page, hyp, 150);
    return union(await box(hyp), await box(outputs), { ...(await box(outputs)), y: (await box(outputs)).y + 60 });
  },
  async (page, snap) => {
    const hyp = page.getByRole("radio", { name: "Hypothetical" });
    await glide(page, ...centerOf(await box(hyp)), 1000);
    await page.waitForTimeout(300);
    await hyp.click();
    await page.waitForTimeout(1400);
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(1800);
    await snap();
    await page.waitForTimeout(800);
  },
);

// f. bond payout order panel
await clip(
  "f-bond-payout-order",
  async (page) => {
    await page.goto(`${SITE}/dashboard/bonds`);
    await settle(page);
    const h = page.getByRole("heading", { name: "Bonds & payout order" });
    const panel = page.locator("section").filter({ has: page.getByRole("heading", { name: /Payout order/ }) }).first();
    await scrollTo(page, h, 80);
    return union(await box(h), await box(panel));
  },
  async (page, snap) => {
    const panel = await box(page.locator("section").filter({ has: page.getByRole("heading", { name: /Payout order/ }) }).first());
    await glide(page, panel.x + panel.width * 0.2, panel.y + panel.height * 0.5, 900);
    await page.waitForTimeout(900);
    await glide(page, panel.x + panel.width * 0.7, panel.y + panel.height * 0.55, 1600);
    await page.waitForTimeout(1200);
    await snap();
    await page.waitForTimeout(1000);
  },
);

// g. reserve panel: hypothetical cover, cannot currently pay out
await clip(
  "g-reserve",
  async (page) => {
    await page.goto(`${SITE}/dashboard/reserve`);
    await settle(page);
    const stats = page.locator("main section").first();
    const note = page.getByText(/reserve cannot currently/).first();
    await scrollTo(page, stats, 90);
    return union(await box(stats), await box(note));
  },
  async (page, snap) => {
    const cards = page.locator("main section").first().locator("> div");
    await glide(page, ...centerOf(await box(cards.nth(0))), 800);
    await page.waitForTimeout(900);
    await glide(page, ...centerOf(await box(cards.nth(1))), 1000);
    await page.waitForTimeout(900);
    await glide(page, ...centerOf(await box(page.getByText(/reserve cannot currently/).first())), 1000);
    await page.waitForTimeout(1300);
    await snap();
  },
);

// h. methodology row → click through to the contract source
await clip(
  "h-methodology-source",
  async (page) => {
    await page.goto(`${SITE}/methodology`);
    await settle(page);
    const link = page.getByRole("link", { name: /get-obligation-per-interval/ }).first();
    await scrollTo(page, link, 200);
    return { x: 0, y: 0, width: W, height: H };
  },
  async (page, snap) => {
    const link = page.getByRole("link", { name: /get-obligation-per-interval/ }).first();
    await glide(page, ...centerOf(await box(link)), 700);
    await page.waitForTimeout(450);
    await link.click();
    // GitHub scrolls to and highlights the linked line once its code view has rendered
    await page.locator("[data-line-number='283'], #L283").first().waitFor({ timeout: 4500 }).catch(() => {});
    await page.waitForTimeout(1200);
    await snap();
    await page.waitForTimeout(600);
  },
  { width: 960, height: 540 },
);

fs.rmSync(BRAND_DIR, { recursive: true, force: true });
await browser.close();
