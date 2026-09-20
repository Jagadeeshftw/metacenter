// Record the Metacenter demo video (1440×900, no audio).
//   node research/scripts/record-demo.mjs <out.webm> [--resolve <ip>]
// Needs `playwright` resolvable from the working directory and a Chromium build.
// Convert with: ffmpeg -i out.webm -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart out.mp4
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [out, flag, ip] = process.argv.slice(2);
const SITE = "https://metacenter.0xo.in";
const args = flag === "--resolve" && ip ? [`--host-resolver-rules=MAP metacenter.0xo.in ${ip}`] : [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args });
const dir = path.dirname(path.resolve(out));
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir, size: { width: 1440, height: 900 } },
});
// dark theme, and a visible cursor so hovers read on video
await ctx.addInitScript(() => {
  localStorage.setItem("theme", "dark");
  const add = () => {
    const c = document.createElement("div");
    c.id = "__cursor";
    Object.assign(c.style, {
      position: "fixed", left: "0", top: "0", width: "18px", height: "18px", marginLeft: "-9px", marginTop: "-9px",
      borderRadius: "50%", border: "2px solid #fff", background: "rgba(38,165,150,0.55)", zIndex: "2147483647",
      pointerEvents: "none", transition: "transform 0.08s", boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
    });
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => (c.style.transform = "scale(0.7)"), true);
    addEventListener("mouseup", () => (c.style.transform = "scale(1)"), true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", add); else add();
});
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const glide = async (x, y, steps = 25) => page.mouse.move(x, y, { steps });
const scrollBy = async (dy, ms = 1200) => {
  const n = Math.max(1, Math.round(ms / 40));
  for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy / n); await wait(40); }
};
const center = async (loc) => {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
};

// 1. Landing, with its motion (~20 s)
await page.goto(SITE, { waitUntil: "networkidle" });
await glide(720, 450, 10);
await wait(1600);
await scrollBy(700, 1100); await wait(1000);   // hero panel, public-data strip
await scrollBy(1000, 1300); await wait(1600);  // bento: orbit, block grid, tests
await scrollBy(2700, 1900); await wait(1200);  // questions it answers, then how to use it
// 2. Dashboard overview via the navbar button (~8 s)
const openBtn = page.getByRole("link", { name: "Open dashboard" }).first();
await glide(...(await center(openBtn)));
await wait(500);
await openBtn.click();
await page.waitForURL("**/dashboard");
await page.waitForLoadState("networkidle");
await wait(2500);
// the headline cards read "onchain": hover the tag for its meaning
const covTag = page.locator("section[aria-label='Headline figures'] [role='tooltip']").nth(1).locator("..");
await glide(...(await center(covTag)));
await wait(2500);
await scrollBy(500, 1000); await wait(1600);
// 3. Coverage: tooltips with provenance tags (~12 s)
await page.goto(`${SITE}/dashboard/coverage`, { waitUntil: "networkidle" });
await wait(1500);
const covChart = page.locator("svg[aria-label^='Coverage per distribution']").first();
let [cx, cy] = await center(covChart);
const cb = await covChart.boundingBox();
await glide(cb.x + cb.width * 0.2, cy, 20); await wait(1200);   // n/a band (no bonds)
await glide(cb.x + cb.width * 0.82, cb.y + cb.height * 0.3, 25); await wait(2200); // 286 point
const poolChart = page.locator("svg[aria-label^='Gross reward pool']").first();
await poolChart.scrollIntoViewIfNeeded(); await wait(600);
const pb = await poolChart.boundingBox();
await glide(pb.x + pb.width * 0.84, pb.y + pb.height * 0.6, 25); await wait(1800);
// 4. Stress test: commit drop, price drop, 3,000 BTC book (~18 s)
await page.goto(`${SITE}/dashboard/stress`, { waitUntil: "networkidle" });
await wait(1500);
const sliders = page.locator("input[type=range]");
// Keyboard steps land exactly on the value; the cursor rides along the thumb for the viewer.
const drag = async (i, pctTarget) => {
  const el = sliders.nth(i);
  const b = await el.boundingBox();
  const y = b.y + b.height / 2;
  const at = (p) => b.x + 8 + ((b.width - 16) * p) / 100;
  await glide(at(0), y, 15);
  await el.focus();
  for (let p = 1; p <= pctTarget; p++) {
    await el.press("ArrowRight");
    await page.mouse.move(at(p), y);
    await wait(45);
  }
};
await drag(0, 30); await wait(1800);
await drag(1, 40); await wait(1800);
const hyp = page.getByRole("radio", { name: "Hypothetical" });
await glide(...(await center(hyp)));
await hyp.click(); await wait(2000);
await scrollBy(450, 1000); await wait(2000);
// 5. Bond payout order (~6 s)
await page.goto(`${SITE}/dashboard/bonds`, { waitUntil: "networkidle" });
await wait(2500);
// 6. The contracts on mainnet, with explorer links (~9 s)
await page.goto(`${SITE}/docs/contracts/deployments`, { waitUntil: "networkidle" });
await wait(1500);
const readerLink = page.getByRole("link", { name: /pox5-reader$/ }).first();
await readerLink.scrollIntoViewIfNeeded();
await glide(...(await center(readerLink)));
await wait(2800);
await scrollBy(250, 700); await wait(1200);
// 7. Methodology: a row that links to a contract function (~10 s)
await page.goto(`${SITE}/methodology`, { waitUntil: "networkidle" });
await wait(1500);
const fnLink = page.getByRole("link", { name: /get-obligation-per-interval/ }).first();
await glide(...(await center(fnLink)));
await wait(1500);
await fnLink.click();
await page.waitForLoadState("domcontentloaded");
await wait(2600);

const video = page.video();
await ctx.close();
await browser.close();
fs.renameSync(await video.path(), out);
console.log("recorded", out);
