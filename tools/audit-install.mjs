import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = (process.argv[2] || 'http://127.0.0.1:3011/sonidos-2025/').replace(/\/?$/, '/');
const installURL = new URL('install/', base).href;
const trigger = '[data-sonidos-install]';
const dialog = '#sonidos-install-dialog';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko)';
const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 (KHTML, like Gecko)';
const win = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)';
const chrome = 'Chrome/150.0.0.0 Safari/537.36';
const cases = [
  { name: 'iPhone Safari', ua: `${iphone} Version/18.0 Mobile/15E148 Safari/604.1`, guide: 'ios-safari', touch: 5, platform: 'iPhone', tokens: [/share/i, /home screen/i] },
  { name: 'iPhone Chrome', ua: `${iphone} CriOS/150.0.0.0 Mobile/15E148 Safari/604.1`, guide: 'ios-chrome', touch: 5, platform: 'iPhone', tokens: [/share/i, /home screen/i] },
  { name: 'iPhone Edge', ua: `${iphone} EdgiOS/150.0.0 Mobile/15E148 Safari/604.1`, guide: 'ios-edge', touch: 5, platform: 'iPhone', tokens: [/share/i, /home screen/i] },
  { name: 'iPhone Firefox', ua: `${iphone} FxiOS/144.0 Mobile/15E148 Safari/604.1`, guide: 'ios-firefox', touch: 5, platform: 'iPhone', tokens: [/share/i, /home screen/i] },
  { name: 'iPad desktop Safari', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', guide: 'ios-safari', touch: 5, platform: 'MacIntel', tokens: [/share/i, /home screen/i] },
  { name: 'Android Chrome', ua: `${android} Chrome/150.0.0.0 Mobile Safari/537.36`, guide: 'android-chrome', touch: 5, platform: 'Linux armv8l', tokens: [/menu/i, /install|home screen/i] },
  { name: 'Samsung Internet', ua: `${android} SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36`, guide: 'android-samsung', touch: 5, platform: 'Linux armv8l', tokens: [/menu/i, /home screen/i] },
  { name: 'Android Firefox', ua: 'Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0', guide: 'android-firefox', touch: 5, platform: 'Linux armv8l', tokens: [/menu/i, /install|home screen/i] },
  { name: 'desktop Safari', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', guide: 'desktop-safari', platform: 'MacIntel', tokens: [/file|share/i, /dock/i] },
  { name: 'desktop Chrome', ua: `${mac} ${chrome}`, guide: 'desktop-chrome', platform: 'MacIntel', tokens: [/menu/i, /install/i] },
  { name: 'desktop Edge', ua: `${win} ${chrome} Edg/150.0.0.0`, guide: 'desktop-edge', platform: 'Win32', tokens: [/menu/i, /install/i] },
  { name: 'desktop Firefox Mac', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:144.0) Gecko/20100101 Firefox/144.0', guide: 'unsupported', platform: 'MacIntel', tokens: [/chrome|edge|safari/i] },
  { name: 'desktop Firefox Windows', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', guide: 'desktop-firefox', platform: 'Win32', tokens: [/web app|install/i] },
  { name: 'Facebook iPhone', ua: `${iphone} Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.0.0]`, guide: 'embedded-ios', touch: 5, platform: 'iPhone', tokens: [/safari|browser/i] },
  { name: 'Instagram iPhone', ua: `${iphone} Mobile/15E148 Instagram 360.0.0.0`, guide: 'embedded-ios', touch: 5, platform: 'iPhone', tokens: [/safari|browser/i] },
  { name: 'Instagram Android', ua: `${android} Chrome/150.0.0.0 Mobile Safari/537.36 Instagram 360.0.0.0 Android`, guide: 'embedded-android', touch: 5, platform: 'Linux armv8l', tokens: [/chrome|browser/i] },
  { name: 'Android WebView', ua: `${android.replace('Pixel 9)', 'Pixel 9; wv)')} Version/4.0 Chrome/150.0.0.0 Mobile Safari/537.36`, guide: 'embedded-android', touch: 5, platform: 'Linux armv8l', tokens: [/chrome|browser/i] },
  { name: 'iPhone Safari Portuguese', ua: `${iphone} Version/18.0 Mobile/15E148 Safari/604.1`, guide: 'ios-safari', touch: 5, platform: 'iPhone', locale: 'pt-BR', tokens: [/compartilh/i, /tela de in[ií]cio/i] },
  { name: 'Android Chrome Portuguese', ua: `${android} Chrome/150.0.0.0 Mobile Safari/537.36`, guide: 'android-chrome', touch: 5, platform: 'Linux armv8l', locale: 'pt-BR', tokens: [/menu/i, /instal|tela de in[ií]cio/i] },
];

const report = { url: installURL, checkedAt: new Date().toISOString(), syntheticNativeEvents: true, physicalDeviceInstallationTested: false, cases: [], behavior: [] };
const browsers = { chromium: await chromium.launch(), webkit: await webkit.launch() };
async function open(test = {}, options = {}) {
  const context = await browsers[options.engine || 'chromium'].newContext({
    userAgent: test.ua || `${mac} ${chrome}`, locale: test.locale || 'en-US',
    viewport: { width: options.width || 390, height: 844 }, hasTouch: !!test.touch,
  });
  await context.addInitScript(({ platform, touch, standalone, early }) => {
    Object.defineProperty(navigator, 'platform', { get: () => platform });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => touch });
    Object.defineProperty(navigator, 'userAgentData', { get: () => undefined });
    Object.defineProperty(navigator, 'standalone', { get: () => standalone });
    if (standalone) {
      const original = matchMedia.bind(window);
      window.matchMedia = query => query === '(display-mode: standalone)' ? { matches: true, media: query, addEventListener() {}, removeEventListener() {} } : original(query);
    }
    window.__installAudit = { calls: 0, activations: [] };
    // A UA-spoofed Chromium session must not leak its own real Chromium event
    // into a test which deliberately models Safari or an unsupported browser.
    window.addEventListener('beforeinstallprompt', event => {
      if (!event.__auditEvent) { event.preventDefault(); event.stopImmediatePropagation(); }
    });
    window.__emitInstallPrompt = (outcome = 'dismissed', error = false) => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      event.__auditEvent = true;
      event.platforms = ['web'];
      event.userChoice = Promise.resolve({ outcome, platform: 'web' });
      event.prompt = () => {
        window.__installAudit.calls++;
        window.__installAudit.activations.push(navigator.userActivation?.isActive ?? null);
        return error ? Promise.reject(new DOMException('Synthetic prompt unavailable', 'NotAllowedError')) : Promise.resolve({ outcome, platform: 'web' });
      };
      window.dispatchEvent(event);
    };
    if (early) document.addEventListener('DOMContentLoaded', () => window.__emitInstallPrompt(), { once: true });
  }, { platform: test.platform || 'MacIntel', touch: test.touch || 0, standalone: !!options.standalone, early: !!options.early });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(options.main ? base : installURL, { waitUntil: 'load' });
  return { context, page, errors };
}
function ordered(text, patterns, label) {
  let offset = 0;
  for (const pattern of patterns) {
    const match = pattern.exec(text.slice(offset));
    assert.ok(match, `${label}: missing/out-of-order ${pattern} in ${text}`);
    offset += match.index + match[0].length;
  }
}

try {
  for (const test of cases) {
    const { context, page, errors } = await open(test);
    try {
      const initial = (await page.locator('body').innerText()).trim();
      assert.match(initial, /^(Install Sonidos app|Instalar (?:o )?(?:app )?Sonidos)$/i, `${test.name}: initial page has extra copy`);
      assert.equal(await page.locator(trigger).count(), 1);
      assert.equal(await page.locator('a[href$=".mobileconfig"]').filter({ visible: true }).count(), 0);
      await page.locator(trigger).click();
      await page.locator(dialog).waitFor({ state: 'visible' });
      assert.equal(await page.locator(dialog).getAttribute('data-guide'), test.guide, test.name);
      const steps = (await page.locator(`${dialog} ol li`).allInnerTexts()).join('\n');
      assert.ok(steps.length > 10, `${test.name}: ordered installation steps missing`);
      ordered(steps, test.tokens, test.name);
      if (test.name === 'iPhone Safari' || test.name === 'iPhone Safari Portuguese') await page.screenshot({ path: `/tmp/sonidos-guide-390-${test.locale ? 'pt' : 'en'}.png` });
      assert.ok(await page.locator(`${dialog} svg`).count(), `${test.name}: visual instruction icons missing`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${test.name}: horizontal overflow`);
      await page.getByRole('button', { name: test.locale ? 'Fechar instruções de instalação' : 'Close installation guide', exact: true }).click();
      assert.equal(await page.locator(dialog).isVisible(), false);
      assert.equal(await page.locator(trigger).evaluate(node => document.activeElement === node), true, `${test.name}: trigger focus not restored`);
      assert.deepEqual(errors, [], test.name);
      report.cases.push({ name: test.name, guide: test.guide, language: test.locale || 'en-US', passed: true, steps });
    } finally { await context.close(); }
  }

  for (const locale of ['en-US', 'pt-BR']) {
    for (const width of [320, 390, 768]) {
      const { context, page, errors } = await open({ ...cases[0], locale }, { main: true, width });
      try {
        await page.waitForFunction(() => document.querySelectorAll('.video-card').length === 20);
        assert.equal(await page.locator(trigger).isVisible(), true, 'Main-page install must remain visible on mobile');
        const boxes = await page.locator('.header .brand, .header .mode-nav, .header [data-sonidos-install]').evaluateAll(nodes => nodes.map(node => {
          const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        }));
        for (const r of boxes) assert.ok(r.x >= 0 && r.right <= width && r.width > 0 && r.height > 0, 'Header item must fit viewport');
        for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
          const x = boxes[a], y = boxes[b];
          assert.ok(x.right <= y.x || y.right <= x.x || x.bottom <= y.y || y.bottom <= x.y, 'Header controls overlap');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: '/tmp/sonidos-header-' + width + '-' + locale + '.png' });
        assert.deepEqual(errors, []);
        report.behavior.push({ name: 'Main header ' + width + 'px ' + locale, passed: true, boxes });
      } finally { await context.close(); }
    }
  }
  for (const item of [{ test: cases[0], width: 320, name: '320-en' }, { test: cases[17], width: 320, name: '320-pt' }, { test: cases[8], width: 1024, name: 'desktop-safari' }]) {
    const { context, page } = await open(item.test, { width: item.width });
    try { await page.locator(trigger).click(); await page.locator(dialog).waitFor({ state: 'visible' }); await page.screenshot({ path: '/tmp/sonidos-guide-' + item.name + '.png' }); }
    finally { await context.close(); }
  }

  // Actual WebKit rendering verifies its dialog/focus behavior separately from
  // UA selection; this does not claim installation on a physical Apple device.
  for (const engine of ['chromium', 'webkit']) {
    const { context, page, errors } = await open(cases[0], { engine, width: 320 });
    try {
      await page.locator(trigger).click();
      await page.locator(dialog).waitFor({ state: 'visible' });
      const focusable = page.locator(`${dialog} button:not([disabled]), ${dialog} a[href], ${dialog} input, ${dialog} summary`).filter({ visible: true });
      await focusable.first().focus(); await page.keyboard.press('Shift+Tab');
      assert.equal(await focusable.last().evaluate(node => document.activeElement === node), true, `${engine}: backwards focus trap`);
      await page.keyboard.press('Tab');
      assert.equal(await focusable.first().evaluate(node => document.activeElement === node), true, `${engine}: forward focus trap`);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator(dialog).isVisible(), false);
      assert.equal(await page.locator(trigger).evaluate(node => document.activeElement === node), true);
      assert.deepEqual(errors, []);
      report.behavior.push({ name: `${engine}: Escape, focus trap and return`, passed: true });
    } finally { await context.close(); }
  }

  for (const mode of ['early', 'late', 'error', 'accepted']) {
    const { context, page, errors } = await open(cases[9], { early: mode === 'early' });
    try {
      if (mode === 'late') {
        await page.locator(trigger).click(); await page.locator(dialog).waitFor({ state: 'visible' });
        await page.evaluate(() => window.__emitInstallPrompt());
        await page.locator('#sonidos-install-native').click();
      } else {
        if (mode !== 'early') await page.evaluate(mode => window.__emitInstallPrompt(mode === 'accepted' ? 'accepted' : 'dismissed', mode === 'error'), mode);
        await page.locator(trigger).click();
      }
      await page.waitForFunction(() => window.__installAudit.calls === 1);
      await page.waitForFunction(() => !document.querySelector('[data-sonidos-install]').disabled);
      assert.deepEqual(await page.evaluate(() => window.__installAudit.activations), [true], `${mode}: lost user activation`);
      assert.equal(new URL(page.url()).pathname, new URL(installURL).pathname, `${mode}: prompt outcome alone must not claim completed installation`);
      assert.doesNotMatch(await page.locator(trigger).innerText(), /^(Open|Abrir)/, `${mode}: prompt outcome alone must not label the app installed`);
      if (mode === 'error') await page.locator(dialog).waitFor({ state: 'visible' });
      assert.deepEqual(errors, [], mode);
      report.behavior.push({ name: `synthetic native ${mode}`, passed: true });
    } finally { await context.close(); }
  }

  for (const test of [cases[0], cases[9]]) {
    const { context, page, errors } = await open(test, { standalone: true });
    try {
      if (await page.locator(trigger).isVisible()) await page.locator(trigger).click();
      assert.equal(await page.locator(dialog).isVisible(), false);
      assert.deepEqual(errors, []);
      report.behavior.push({ name: `${test.name}: standalone avoids guide`, passed: true });
    } finally { await context.close(); }
  }

  const { context, page, errors } = await open(cases[0]);
  try {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.reload();
    await context.setOffline(true);
    await page.goto(base);
    await page.waitForFunction(() => document.querySelectorAll('.video-card').length === 20);
    await page.locator(trigger).click(); await page.locator(dialog).waitFor({ state: 'visible' });
    assert.equal(await page.locator(dialog).getAttribute('data-guide'), 'ios-safari');
    await page.goto(installURL);
    await page.locator(trigger).click(); await page.locator(dialog).waitFor({ state: 'visible' });
    assert.equal(await page.locator(dialog).getAttribute('data-guide'), 'ios-safari');
    assert.deepEqual(errors, []);
    report.behavior.push({ name: 'offline root and install share working guide without shell corruption', passed: true });
  } finally { await context.close(); }

  await fs.writeFile(new URL('../../../video-work/release/device-install-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS ${report.cases.length} browser/language guides and ${report.behavior.length} interaction/offline checks.`);
} finally {
  await Promise.all(Object.values(browsers).map(browser => browser.close()));
}
