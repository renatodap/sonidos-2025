# Sonidos 2025 delivery site

Static, path-mounted PWA for `https://renatodap.me/sonidos-2025`.

The page reads `data.json` and streams the media from the public MinIO bucket
`/s3/sonidos-2025/`. The shell is cached; the large audio/video files are
intentionally network streamed instead of being precached.
