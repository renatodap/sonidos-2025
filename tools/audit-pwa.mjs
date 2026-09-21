/**
 * Ship gate: the app installs, and its chrome does not move.
 *
 * Every check here is something a model will confidently report as done and a
 * phone will disagree with: a manifest whose scope swallows the whole domain,
 * an apple-touch-icon that 404s so the home screen shows the bare domain, a
 * bottom nav that rides up on the keyboard, a shell built on 100vh that puts
 * its own nav below the fold on first paint.
 *
 * Copy to <project>/tools/audit-pwa.mjs.
 *
 *   npm i -D playwright
 *   node tools/audit-pwa.mjs https://parityrfp.com/cs/<project>/
 *
 * Exit 1 on any failure. Run it in CI after the deploy step, against staging.
 * Overflow across the full width range is aslan-responsive/audit-mobile.mjs —
 * run both.
 */
import { chromium, devices } from 'playwright';

const BASE = (process.argv[2] || process.env.AUDIT_BASE_URL || 'http://localhost:8000')
  .replace(/\/$/, '') + '/';

const fail = [];
const bad = (m) => fail.push(m);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });

/* ---- 1 · head: the four things iOS and Android each need ---------------- */

const head = await page.evaluate(() => ({
  viewport: document.querySelector('meta[name=viewport]')?.content ?? '',
  themeColor: document.querySelector('meta[name=theme-color]')?.content ?? '',
  appleIcon: document.querySelector('link[rel~=apple-touch-icon]')?.href ?? '',
  manifest: document.querySelector('link[rel=manifest]')?.href ?? '',
}));

if (!head.manifest) bad('no <link rel="manifest">');
if (!/viewport-fit=cover/.test(head.viewport)) bad('viewport lacks viewport-fit=cover — every safe-area inset resolves to 0px');
if (!/interactive-widget=resizes-content/.test(head.viewport)) bad('viewport lacks interactive-widget=resizes-content — the keyboard will move the bottom nav');
if (/user-scalable\s*=\s*(no|0)/.test(head.viewport)) bad('viewport disables zoom — fails WCAG 1.4.4');
// iOS ignores manifest icons entirely; without this the home screen shows a screenshot.
if (!head.appleIcon) bad('no apple-touch-icon — iOS will use a screenshot and the bare domain');

/* ---- 2 · manifest: installable, and scoped to THIS app ------------------ */

let manifest = null;
if (head.manifest) {
  const res = await page.request.get(head.manifest);
  if (!res.ok()) bad(`manifest ${res.status()} at ${head.manifest}`);
  else {
    manifest = await res.json().catch(() => null);
    if (!manifest) bad('manifest is not valid JSON');
  }
}

if (manifest) {
  for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'theme_color', 'background_color']) {
    if (!manifest[k]) bad(`manifest missing "${k}"`);
  }
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) {
    bad(`manifest display="${manifest.display}" is not installable (and iOS gates web push on standalone)`);
  }
  // A bare "/" scope on a /cs/<client>/ deploy captures every other client's tool.
  const deployPath = new URL(BASE).pathname;
  if (deployPath !== '/' && manifest.scope && new URL(manifest.scope, BASE).pathname === '/') {
    bad(`manifest scope is "/" but the app is deployed at ${deployPath} — it will swallow the whole domain`);
  }
  if (head.themeColor && manifest.theme_color && head.themeColor !== manifest.theme_color) {
    bad(`theme-color meta (${head.themeColor}) != manifest theme_color (${manifest.theme_color}) — status bar changes colour once installed`);
  }

  const icons = manifest.icons ?? [];
  const sizes = new Set(icons.flatMap((i) => String(i.sizes ?? '').split(/\s+/)));
  if (!sizes.has('192x192')) bad('manifest has no 192x192 icon (Chrome install prompt)');
  if (!sizes.has('512x512')) bad('manifest has no 512x512 icon (splash / hi-dpi)');
  if (!icons.some((i) => String(i.purpose ?? '').split(/\s+/).includes('maskable'))) {
    bad('no maskable icon — Android will letterbox the adaptive icon');
  }
  if (icons.some((i) => /any/.test(i.purpose ?? '') && /maskable/.test(i.purpose ?? ''))) {
    bad('an icon declares purpose "any maskable" — split into two files, it crops wrong in both roles');
  }
  for (const icon of icons) {
    const r = await page.request.get(new URL(icon.src, head.manifest).href);
    if (!r.ok()) bad(`manifest icon ${r.status()}: ${icon.src}`);
  }
}

if (head.appleIcon) {
  const r = await page.request.get(head.appleIcon);
  if (!r.ok()) bad(`apple-touch-icon ${r.status()}: ${head.appleIcon}`);
}

/* ---- 3 · service worker, with a real fetch handler ---------------------- */

const swReady = await page
  .waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready, null, { timeout: 8000 })
  .then(() => true)
  .catch(() => false);
if (!swReady) bad('no service worker controlling the page — not installable');
else {
  // Registration alone does not make it installable; the SW must handle fetch.
  const handlesFetch = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const url = reg?.active?.scriptURL;
    if (!url) return false;
    return (await (await fetch(url)).text()).includes("addEventListener('fetch'")
        || (await (await fetch(url)).text()).includes('addEventListener("fetch"');
  }).catch(() => false);
  if (!handlesFetch) bad('service worker has no fetch handler — browsers will not offer install');
}

/* ---- 4 · the shell holds still ----------------------------------------- */

const shell = await page.evaluate(() => {
  const vh = window.innerHeight;
  // Exactly one scroller, and body is not it.
  const scrollers = [...document.querySelectorAll('*')].filter((el) => {
    const s = getComputedStyle(el);
    return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1;
  });
  return {
    bodyScrolls: document.body.scrollHeight > window.innerHeight + 1,
    scrollerCount: scrollers.length,
    usesVh: [...document.styleSheets].some((ss) => {
      try { return [...ss.cssRules].some((r) => /height:\s*100vh/.test(r.cssText)); }
      catch { return false; }
    }),
    vh,
  };
});

if (shell.usesVh) bad('a stylesheet sets height:100vh — use 100dvh; 100vh resolves to the largest viewport and puts the nav below the fold on first paint');
if (shell.bodyScrolls) bad('body scrolls — the shell must be the viewport with one inner scroller, or the header drifts');
if (shell.scrollerCount > 1) bad(`${shell.scrollerCount} scrolling elements — exactly one (the content row) is the rule`);

/* ---- 5 · the keyboard does not move the chrome -------------------------- */

const nav = page.locator('[data-app-nav], .bottom-nav, nav[aria-label*="Primary" i]').first();
const header = page.locator('[data-app-header], header').first();

if (await nav.count()) {
  const before = await nav.boundingBox();
  const input = page.locator('input:not([type=hidden]), textarea, select').first();
  if (await input.count()) {
    await input.focus();
    // Chromium has no soft keyboard; shrink the viewport by a keyboard's height
    // to reproduce what interactive-widget=resizes-content produces on a phone.
    await page.setViewportSize({ width: 393, height: 852 - 336 });
    await page.waitForTimeout(250);
    const after = await nav.boundingBox();
    const hdr = (await header.count()) ? await header.boundingBox() : null;
    if (before && after && Math.abs((after.y + after.height) - (page.viewportSize().height)) > 2) {
      bad('bottom nav is not flush to the viewport bottom once the keyboard opens');
    }
    if (hdr && Math.abs(hdr.y) > 2) bad(`header moved to y=${Math.round(hdr.y)} with the keyboard open — it must not move`);
    await page.setViewportSize({ width: 393, height: 852 });
  }
} else {
  bad('no bottom nav found ([data-app-nav] / .bottom-nav) — mark it so this gate can check it');
}

/* ---- 6 · safe-area padding is actually applied -------------------------- */

if (await nav.count()) {
  const pb = await nav.evaluate((el) => getComputedStyle(el).paddingBottom);
  // On a device with no inset the env() is 0px; a nav sitting on the screen edge
  // is the bug this catches. max(Npx, env(...)) is the fix.
  if (parseFloat(pb) < 8) bad(`bottom nav padding-bottom is ${pb} — use max(12px, env(safe-area-inset-bottom))`);
}

await browser.close();

if (fail.length) {
  console.error(`\n✗ PWA gate failed (${fail.length}) at ${BASE}\n`);
  for (const f of fail) console.error('  · ' + f);
  process.exit(1);
}
console.log(`✓ PWA gate passed at ${BASE}`);
