import { webkit } from 'playwright';
import assert from 'node:assert/strict';

const base = process.argv[2] || 'https://renatodap.me/sonidos-2025/';
const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.SONIDOS_CATALOG?.songs);
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await page.getByRole('button', { name: 'Play Creep', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#audio').currentTime > 0, {}, { timeout: 30000 });
  await page.evaluate(() => { document.querySelector('#audio').currentTime = 90; });
  await page.waitForFunction(() => document.querySelector('#audio').currentTime > 90, {}, { timeout: 15000 });
  assert.equal(await page.evaluate(() => navigator.mediaSession.metadata.title), 'Creep');
  await page.getByRole('button', { name: 'Save offline Creep', exact: true }).click();
  await page.getByRole('button', { name: 'Remove offline copy of Creep', exact: true }).waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Close audio player', exact: true }).click();
  await page.getByRole('button', { name: 'Play Creep', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#audio').currentTime > 0, {}, { timeout: 15000 });
  assert.match(await page.locator('#audio').getAttribute('src'), /^blob:/);
  const cachedPlayback = await page.evaluate(() => {
    const audio = document.querySelector('#audio');
    return { currentTime: audio.currentTime, duration: audio.duration, readyState: audio.readyState, error: audio.error?.code ?? null };
  });
  assert.deepEqual(errors, []);

  // Isolate the installed WebKit offline-emulation limitation from the app:
  // create a valid one-second PCM WAV directly in memory, with no network,
  // cache, service worker, codec dependency, or async click handler involved.
  await page.evaluate(() => {
    const samples = 48000;
    const bytes = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(bytes);
    const text = (offset, value) => [...value].forEach((ch, index) => view.setUint8(offset + index, ch.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 48000, true); view.setUint32(28, 96000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 440 / 48000) * 2000, true);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    document.querySelector('#audio').pause();
    document.body.innerHTML = '<button id="fixture-play">Test generated sound</button><audio id="fixture"></audio>';
    document.querySelector('#fixture-play').onclick = () => {
      const audio = document.querySelector('#fixture');
      window.fixturePlayError = null;
      audio.src = url;
      audio.play().catch(error => { window.fixturePlayError = error.name; });
    };
  });
  const fixture = [];
  for (const offline of [false, true]) {
    await context.setOffline(offline);
    await page.locator('#fixture-play').click();
    await page.waitForFunction(() => document.querySelector('#fixture').currentTime > 0 || document.querySelector('#fixture').error, {}, { timeout: 5000 });
    fixture.push({ offline, ...await page.evaluate(() => {
      const audio = document.querySelector('#fixture');
      return { currentTime: audio.currentTime, readyState: audio.readyState, error: audio.error?.code ?? null, playError: window.fixturePlayError };
    }) });
  }
  assert.ok(fixture[0].currentTime > 0, 'Generated PCM WAV must be valid and playable.');
  console.log(JSON.stringify({
    url: base, engine: 'webkit', streamedAudioAndSeek: true, cacheSave: true, cachedBlobPlaybackWhileOnline: cachedPlayback,
    mediaSession: true, generatedPcmFixture: fixture, simulatedOfflineMedia: fixture[1].currentTime > 0 ? 'passed' : 'blocked by engine emulation, including generated PCM fixture',
    physicalIPhoneTested: false, pageErrors: errors,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
