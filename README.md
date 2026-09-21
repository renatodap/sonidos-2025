# Caceta de Golira · Sonidos 2025

Static media catalog at https://renatodap.me/sonidos-2025/.

- `data.json` is the source catalog. Run `npm run build` after editing it to regenerate `catalog.js`.
- Only enable `mediaReady` and `audioReady` after finished files are public and verified. Individual items support `videoReady`/`audioReady` overrides; full-set overrides are `fullVideoReady`/`fullAudioReady`. Keep global flags false during incremental publication.
- Song audio is `audio/{NN-label}.m4a`; the `master` path retains the WAV counterpart. Full set audio is `full/FULL-Sonidos-Studio-Cuts.m4a`.
- Add real `youtubeId` values to songs or `fullYoutubeId` at the root to prefer the YouTube player. MP4 playback remains the fallback.
- Artwork: `thumbnails/{NN-label}-16x9.webp`, `{NN-label}-square.webp`, plus `full-set-16x9.webp`/`full-set-square.webp`. Set item `artworkReady: true` only for reviewed exports; global `artworkReady` enables all artwork once verified. Original-camera stills are the temporary thumbnail fallback.
- Saved audio uses its own CacheStorage cache. Playback of saved files uses local blob URLs, including when offline. Shell updates preserve audio. Browser storage can be evicted by the OS; the Download link saves a separate audio file.
- Native audio, MediaSession, and supported AudioSession playback mode enable system audio controls. Physical iPhone lock-screen/background behavior still needs device verification; desktop browser tests do not prove OS behavior.

Local preview from the parent `site` directory: `python3 -m http.server 3011`, then open `/sonidos-2025/`.

Checks:

```
npm ci
npx playwright install chromium
npm run build
node tools/audit-pwa.mjs http://127.0.0.1:3011/sonidos-2025/
node tools/audit-mobile.mjs http://127.0.0.1:3011/sonidos-2025
node tools/test-media.mjs http://127.0.0.1:3011/sonidos-2025/
```

Deploy: push to the existing GitHub repository, then use the infra app `sonidos-2025`. Its nginx redirect preserves the subpath and never exposes the internal port. Media publication is incremental: each audio object requires a current master/HTTP proof and each YouTube video requires final render, picture, technical and completed unlisted-upload proof. Pending items stay hidden. The full set remains gated independently.
