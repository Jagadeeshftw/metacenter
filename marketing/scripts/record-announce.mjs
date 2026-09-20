// Announcement clips for X: a short title card, then real footage from the live site, then the
// end card. Nothing is mocked: the footage frames come from https://metacenter.0xo.in.
//
//   node record-announce.mjs <outDir> [--resolve <ip>] [--only mainnet-live,applied]
//
// Each clip is 7.0 s at 30 fps, no audio:
//   0.0-1.0  logo C fades and rises in on the dark ground
//   1.0-3.0  headline, in Geist, brand colours, with the landing page's slow glow
//   3.0-5.5  two live shots, 1.25 s each, with the logo watermark
//   5.5-7.0  end card: logo, metacenter.0xo.in, @metacenterbtc
//
// Exports per clip: 1080x1080 and 1280x720 MP4 (H.264), a 720x720 GIF at 15 fps with its own
// palette so the text stays crisp, and a PNG of the end card.
//
// Needs `playwright` resolvable from the working directory, CHROMIUM_PATH, ffmpeg on PATH, and
// GEIST_DIR pointing at geist/dist/fonts/geist-sans for the text.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://metacenter.0xo.in";
const HANDLE = process.env.X_HANDLE ?? "@metacenterbtc";
const FPS = 30, DPR = 2;
// 3 + 1.25 + 1.25 + 1.5 = 7.0 s. The joined file carries one frame more than the sum, so the
// end card is a frame short and the clip lands on 7.000.
const T = { intro: 3, shot: 1.25, end: 1.5 - 1 / 30 };

const argv = process.argv.slice(2);
const OUT = path.resolve(argv[0] ?? "clips/announce");
const ip = argv.includes("--resolve") ? argv[argv.indexOf("--resolve") + 1] : null;
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : null;
const ROOT = process.env.REPO_ROOT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MARK = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "brand", "mark.json"), "utf8"));
const GEIST = process.env.GEIST_DIR;
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  { key: "1080x1080", w: 1080, h: 1080, shotVp: { width: 760, height: 760 } },
  { key: "1280x720", w: 1280, h: 720, shotVp: { width: 1280, height: 720 } },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: [`--force-device-scale-factor=${DPR}`, ...(ip ? [`--host-resolver-rules=MAP metacenter.0xo.in ${ip}`] : [])],
});

// ---------------------------------------------------------------- brand bits
const markSvg = (size, ink = "#e9eef2", accent = "#26a596") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK.viewBox}" width="${size}" height="${size}">${MARK.svg
    .replaceAll("{ink}", ink)
    .replaceAll("{accent}", accent)}</svg>`;
const fontCss = GEIST
  ? `@font-face{font-family:Geist;font-weight:600;src:url("file://${path.join(GEIST, "Geist-SemiBold.ttf")}")}` +
    `@font-face{font-family:Geist;font-weight:400;src:url("file://${path.join(GEIST, "Geist-Regular.ttf")}")}`
  : "";
const page$ = (html) =>
  `<html><head><style>${fontCss}
     *{box-sizing:border-box}
     body{margin:0;background:#07090c;color:#e9eef2;font-family:Geist,ui-sans-serif,system-ui,sans-serif;overflow:hidden}
   </style></head><body>${html}</body></html>`;

async function renderPng(html, w, h, file, transparent = false) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(page$(html));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
}

/** The end card, also saved on its own as a still. */
const endCardHtml = (w, h) => {
  const big = Math.round(Math.min(w, h) * 0.2);
  return `<div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(big * 0.26)}px;
      background:radial-gradient(closest-side at 50% 42%,rgba(38,165,150,.18),rgba(7,9,12,0) 70%),#07090c">
    <div style="display:flex;align-items:center;gap:${Math.round(big * 0.22)}px">${markSvg(big)}<span style="font-size:${Math.round(big * 0.62)}px;font-weight:600;letter-spacing:-0.02em">Metacenter</span></div>
    <div style="font-size:${Math.round(big * 0.3)}px;color:#26a596;font-weight:600">metacenter.0xo.in</div>
    <div style="font-size:${Math.round(big * 0.24)}px;color:#a9b4bf">${HANDLE}</div>
  </div>`;
};

/** Title card: the logo rises in, then the headline. Kept slow, like the landing page. */
const introHtml = (headline, w, h) => {
  const big = Math.round(Math.min(w, h) * 0.17);
  const size = Math.round(Math.min(w, h) * (w === h ? 0.082 : 0.072));
  return `<div style="width:${w}px;height:${h}px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(big * 0.3)}px;background:#07090c">
    <div style="position:absolute;inset:0;background:radial-gradient(closest-side at 50% 45%,rgba(38,165,150,.20),rgba(7,9,12,0) 72%);animation:glow 3s ease-out both"></div>
    <div style="position:relative;animation:rise 900ms cubic-bezier(.2,.7,.3,1) both">${markSvg(big)}</div>
    <div style="position:relative;max-width:${Math.round(w * 0.82)}px;text-align:center;font-size:${size}px;line-height:1.16;font-weight:600;letter-spacing:-0.02em;
         animation:headline 900ms cubic-bezier(.2,.7,.3,1) 1000ms both">${headline}</div>
    <style>
      @keyframes rise{from{opacity:0;transform:translateY(26px) scale(.92)}to{opacity:1;transform:none}}
      @keyframes headline{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
      @keyframes glow{from{opacity:.35;transform:scale(.9)}to{opacity:1;transform:scale(1.06)}}
    </style>
  </div>`;
};

// ------------------------------------------------------------- frame capture
/** Screencast `page` for `seconds`, keeping only full-viewport frames. */
async function capture(page, vp, seconds, act) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    if (f.metadata.deviceWidth === vp.width && f.metadata.deviceHeight === vp.height)
      frames.push({ ts: f.metadata.timestamp, data: f.data });
    try {
      await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
    } catch {}
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 94, maxWidth: vp.width * DPR, maxHeight: vp.height * DPR, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  if (act) await act();
  await page.waitForTimeout(seconds * 1000);
  await cdp.send("Page.stopScreencast");
  await cdp.detach().catch(() => {});
  return { frames, t0 };
}

/**
 * Frames -> one segment mp4 of exactly `seconds`, scaled to w x h.
 * `crop` takes a region of the frame; `crop: "contain"` instead fits the whole frame in and pads
 * with the page's own background, for a shot that must not lose any text at the edges.
 */
function segment(name, { frames, t0 }, crop, w, h, seconds, watermark) {
  const dir = path.join(OUT, `.frames-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const kept = frames.filter((f) => f.ts >= t0).sort((a, b) => a.ts - b.ts);
  // a page that never repaints sends a single frame; that is fine, it just gets held
  if (kept.length === 0) throw new Error(`${name}: no frames captured`);
  const lines = ["ffconcat version 1.0"];
  kept.forEach((f, i) => {
    const file = `f${String(i).padStart(5, "0")}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(f.data, "base64"));
    const next = kept[i + 1]?.ts ?? f.ts + 1 / FPS;
    lines.push(`file ${file}`, `duration ${Math.max(1 / FPS, next - f.ts).toFixed(4)}`);
  });
  // Chrome only sends a frame when something changed, so a still stretch ends the list early.
  // Hold the last frame long enough for the trim below to cut at exactly `seconds`.
  const last = `f${String(kept.length - 1).padStart(5, "0")}.jpg`;
  const span = kept.length > 1 ? kept.at(-1).ts - kept[0].ts : 0;
  lines.push(`file ${last}`, `duration ${Math.max(1 / FPS, seconds - span + 0.5).toFixed(4)}`, `file ${last}`);
  fs.writeFileSync(path.join(dir, "list.ffconcat"), lines.join("\n"));

  const out = path.join(OUT, `.seg-${name}.mp4`);
  const scale =
    crop === "contain"
      ? `scale=${w}:${h}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x07090c`
      : `${crop ? `crop=${crop.w * DPR}:${crop.h * DPR}:${crop.x * DPR}:${crop.y * DPR},` : ""}scale=${w}:${h}:flags=lanczos`;
  const chain = `[0:v]${scale},fps=${FPS},format=yuv420p,setsar=1,trim=duration=${seconds},setpts=PTS-STARTPTS`;
  const args = ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.ffconcat")];
  if (watermark) args.push("-i", watermark);
  args.push(
    "-filter_complex",
    watermark ? `${chain}[v];[v][1:v]overlay=W-w-${Math.round(w * 0.022)}:H-h-${Math.round(h * 0.022)}:format=auto[out]` : `${chain}[out]`,
    "-map", "[out]", "-t", String(seconds), "-r", String(FPS),
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-an", out,
  );
  execFileSync("ffmpeg", args);
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

/** A still image -> a segment of `seconds`. */
function stillSegment(name, png, w, h, seconds) {
  const out = path.join(OUT, `.seg-${name}.mp4`);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-loop", "1", "-t", String(seconds), "-i", png,
    "-vf", `scale=${w}:${h},fps=${FPS},format=yuv420p,setsar=1`,
    "-t", String(seconds), "-r", String(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-an", out,
  ]);
  return out;
}

function join(segments, out) {
  const list = path.join(OUT, ".join.txt");
  fs.writeFileSync(list, segments.map((s) => `file '${s}'`).join("\n"));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
  fs.rmSync(list, { force: true });
  segments.forEach((s) => fs.rmSync(s, { force: true }));
}

/** GIF at 720x720, 15 fps, with a palette built from the clip so the text stays readable. */
function gif(src, out) {
  const palette = path.join(OUT, ".palette.png");
  const chain = "fps=15,scale=720:720:flags=lanczos";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", `${chain},palettegen=max_colors=256:stats_mode=diff`, palette]);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", src, "-i", palette,
    "-lavfi", `${chain}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
    "-loop", "0", out,
  ]);
  fs.rmSync(palette, { force: true });
}

// --------------------------------------------------------------- site shots
const box = async (loc) => {
  const b = await loc.boundingBox();
  if (!b) throw new Error("element not visible");
  return b;
};
/** Expand a rect to an aspect ratio, pad it, keep it inside the viewport. */
function fit(r, vp, aspect, pad = 18) {
  let w = r.width + pad * 2, h = r.height + pad * 2;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  if (w > vp.width) { w = vp.width; h = w / aspect; }
  if (h > vp.height) { h = vp.height; w = h * aspect; }
  let x = r.x + r.width / 2 - w / 2, y = r.y + r.height / 2 - h / 2;
  x = Math.max(0, Math.min(vp.width - w, x));
  y = Math.max(0, Math.min(vp.height - h, y));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

async function sitePage(vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: DPR });
  await ctx.addInitScript(() => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem("mc-sidebar", "open");
  });
  return { ctx, page: await ctx.newPage() };
}

/**
 * The shots each clip uses, in order. Every one is the live site.
 * `prepare` navigates and settles the page before recording starts and returns the crop;
 * `during` is what happens while the screencast runs.
 */
const SHOTS = {
  "mainnet-live": [
    {
      // the landing hero, caught mid-motion
      prepare: async (page, vp, aspect) => {
        await page.goto(SITE, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        const hero = page.locator("#home h1, #home h2").first();
        const b = await box(hero).catch(() => ({ x: 0, y: 0, width: vp.width, height: vp.height * 0.6 }));
        return fit({ x: 0, y: Math.max(0, b.y - 40), width: vp.width, height: b.height + 220 }, vp, aspect, 0);
      },
    },
    {
      // a dashboard card: the onchain tag, and the block the figure was computed at
      prepare: async (page, vp, aspect) => {
        await page.goto(`${SITE}/dashboard`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1500);
        const card = page.locator("section[aria-label='Headline figures'] > div").nth(1);
        await card.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        // at the output's own aspect the whole viewport already frames it, and cropping would
        // shave the headings at the edges
        if (Math.abs(aspect - vp.width / vp.height) < 0.01) return null;
        const b = await box(card);
        // from the top bar (cycle and Bitcoin height) down through the card's source line
        return fit({ x: b.x, y: 0, width: b.width, height: b.y + b.height }, vp, aspect, 14);
      },
      during: async (page) => {
        // the provenance tag says what "onchain" means
        const tag = page.locator("section[aria-label='Headline figures'] [role='tooltip']").nth(1).locator("..");
        await tag.hover().catch(() => {});
      },
    },
  ],
  applied: [
    {
      // A viewport the size of the output, so the whole docs layout (sidebar included) is in
      // frame at its native scale: nothing is cut off and the text stays phone-legible. The
      // sidebar needs a desktop width, and it is still there at 1060.
      vp: (aspect) => (aspect === 1 ? { width: 1060, height: 1060 } : { width: 1280, height: 720 }),
      prepare: async (page, vp, aspect) => {
        await page.goto(`${SITE}/docs`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1500);
        return null; // the whole viewport
      },
      during: async (page) => {
        for (let i = 0; i < 12; i++) {
          await page.mouse.wheel(0, 7);
          await page.waitForTimeout(45);
        }
      },
    },
    {
      // back to the landing page
      prepare: async (page, vp, aspect) => {
        await page.goto(SITE, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        const hero = page.locator("#home h1, #home h2").first();
        const b = await box(hero).catch(() => ({ x: 0, y: 0, width: vp.width, height: vp.height * 0.6 }));
        return fit({ x: 0, y: Math.max(0, b.y - 40), width: vp.width, height: b.height + 220 }, vp, aspect, 0);
      },
    },
  ],
};

const CLIPS = [
  { name: "mainnet-live", headline: "Metacenter is live on<br>Stacks mainnet" },
  { name: "applied", headline: "Applied to the Stacks<br>Endowment Q3 2026 grants" },
];

for (const clip of CLIPS) {
  if (only && !only.includes(clip.name)) continue;
  const report = [];
  for (const size of SIZES) {
    const { w, h, key, shotVp } = size;
    const aspect = w / h;

    // end card (also kept as a still for the square size)
    const endPng = path.join(OUT, `${clip.name}-endcard-${key}.png`);
    await renderPng(endCardHtml(w, h), w, h, endPng);

    // 1. title card
    const introPage = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const intro = await capture(introPage, { width: w, height: h }, T.intro, async () => {
      await introPage.setContent(page$(introHtml(clip.headline, w, h)));
      await introPage.evaluate(() => document.fonts.ready);
    });
    const introSeg = segment(`${clip.name}-intro-${key}`, intro, null, w, h, T.intro);
    await introPage.close();

    // 2. two live shots
    const watermark = path.join(OUT, `.watermark-${key}.png`);
    const wm = Math.round(Math.min(w, h) * 0.05);
    await renderPng(`<div style="width:${wm}px;height:${wm}px;opacity:.85">${markSvg(wm)}</div>`, wm, wm, watermark, true);
    const shotSegs = [];
    for (const [i, shot] of SHOTS[clip.name].entries()) {
      const vp = (typeof shot.vp === "function" ? shot.vp(aspect) : shot.vp) ?? shotVp;
      const { ctx, page } = await sitePage(vp);
      const crop = await shot.prepare(page, vp, aspect);
      const cap = await capture(page, vp, T.shot, shot.during ? () => shot.during(page) : null);
      shotSegs.push(segment(`${clip.name}-shot${i}-${key}`, cap, crop, w, h, T.shot, watermark));
      await ctx.close();
    }
    fs.rmSync(watermark, { force: true });

    // 3. end card, then join
    const endSeg = stillSegment(`${clip.name}-end-${key}`, endPng, w, h, T.end);
    const mp4 = path.join(OUT, `${clip.name}-${key}.mp4`);
    join([introSeg, ...shotSegs, endSeg], mp4);
    const mb = (fs.statSync(mp4).size / 1e6).toFixed(2);
    report.push(`${key} ${mb} MB`);

    if (key === "1080x1080") {
      const g = path.join(OUT, `${clip.name}-720.gif`);
      gif(mp4, g);
      report.push(`gif ${(fs.statSync(g).size / 1e6).toFixed(2)} MB`);
    } else {
      fs.rmSync(endPng, { force: true }); // keep one end-card still, from the square export
    }
  }
  console.log(`${clip.name}: ${report.join(" · ")}`);
}

await browser.close();
