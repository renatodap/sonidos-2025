/**
 * Ship gate: zero horizontal overflow, 320 -> 1920px, on every listed page.
 *
 * This exists because eyeballing does not hold. The recurring shapes: a header
 * whose tagline pushes the CTA off a 390px screen, and a CSS grid whose items
 * default to min-width:auto and blow the track past the viewport. Both are
 * invisible on a laptop and obvious on a phone. A model told "no horizontal
 * overflow" regresses; a script that fails the build does not.
 *
 * Copy to <project>/tools/audit-mobile.mjs and edit PAGES (or pass paths in).
 *
 *   npm i -D playwright
 *   node tools/audit-mobile.mjs https://parityrfp.com/cs/<project> / /films /visit
 *   node tools/audit-mobile.mjs                       # uses the defaults below
 *
 * Exit 1 on any failure, with the offending element printed. Wire it into CI
 * after the deploy step, against the staging URL.
 */
import { chromium } from 'playwright';

const [, , baseArg, ...pathArgs] = process.argv;

const BASE = (baseArg || process.env.AUDIT_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

/** Every public route worth gating. Include one detail page per dynamic type. */
const PAGES = pathArgs.length ? pathArgs : ['/'];

/**
 * 320 is the real floor - an iPhone SE in landscape split view is narrower than
 * most people assume. 1920 catches the opposite failure: content that stops
 * filling and leaves a void. The middle values are the project breakpoints.
 */
const WIDTHS = [320, 390, 430, 601, 768, 1024, 1440, 1920];

const failures = [];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

for (const path of PAGES) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });

    let res;
    try {
      res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      failures.push(`${path} @${width}  LOAD FAILED: ${e.message}`);
      continue;
    }
    if (res && res.status() >= 400) {
      failures.push(`${path} @${width}  HTTP ${res.status()}`);
      continue;
    }

    const report = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        // 1px of tolerance for sub-pixel rounding.
        if (r.right > vw + 1 || r.left < -1) {
          bad.push(`<${el.tagName.toLowerCase()} class="${(el.className || '').toString().slice(0, 50)}"> `
                 + `${Math.round(r.left)}..${Math.round(r.right)} (vw ${vw})`);
        }
      }
      return {
        vw,
        docScroll: document.documentElement.scrollWidth,
        bodyScroll: document.body.scrollWidth,
        bad: bad.slice(0, 4),
      };
    });

    // body.scrollWidth is the honest number: html{overflow-x:clip} hides the
    // scrollbar but the content is still unreachable, which is WORSE than a
    // visible overflow because nobody notices it.
    if (report.bodyScroll > report.vw + 1) {
      failures.push(
        `${path} @${width}  body scrollWidth ${report.bodyScroll} > ${report.vw}\n` +
        report.bad.map((b) => `        ${b}`).join('\n')
      );
    }
  }
}

await browser.close();

if (failures.length) {
  console.error('\nHORIZONTAL OVERFLOW - ' + failures.length + ' failure(s):\n');
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}

console.log(`OK  no horizontal overflow across ${PAGES.length} pages x ${WIDTHS.length} widths`);
