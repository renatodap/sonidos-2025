(() => {
  'use strict';
  const APP_URL = new URL('./', document.currentScript.src);
  const AUDIO_CACHE = 'sonidos-audio-masters-v7';
  const OFFLINE_ENABLED = location.protocol !== 'file:' && 'caches' in window;
  if ('audioSession' in navigator) { try { navigator.audioSession.type = 'playback'; } catch {} }
  const $ = (selector) => document.querySelector(selector);
  const audio = $('#audio');
  const video = $('#video');
  const data = window.SONIDOS_CATALOG;
  const state = { mode: 'videos', category: 'songs', audioFilter: 'all', selected: null, saved: new Set(), saving: new Map(), objectURL: null, playToken: 0, deferredInstall: null };
  const full = { id: 'full-set', title: 'Full set', video: data.fullVideo, audio: data.fullAudio, audioAliases: data.fullAudioAliases, master: data.fullMaster, duration: data.fullDuration, thumbnail: data.fullThumbnail || './thumbs/full.jpg', thumbnailFallback: './thumbs/full.jpg', artwork: data.fullArtwork, youtubeId: data.fullYoutubeId, audioReady: data.fullAudioReady, videoReady: data.fullVideoReady, artworkReady: data.fullArtworkReady };
  const tracks = [...data.songs, full];
  const key = (item) => item.id || item.label || item.title;
  const media = (path) => new URL(path, data.mediaBase).href;
  const offlineURLs = (item) => [item.audio, ...(item.audioAliases || [])].filter(Boolean).map(media);
  async function savedResponse(cache, item) {
    for (const url of offlineURLs(item)) { const response = await cache.match(url); if (response) return response; }
    return null;
  }
  const ready = (item, kind) => item[`${kind}Ready`] ?? data[kind === 'audio' ? 'audioReady' : 'mediaReady'] !== false;
  const formatTime = (seconds) => {
    const n = Math.round(Number.parseFloat(seconds) || 0);
    return n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n % 3600 / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function announce(message) {
    $('#status').textContent = message;
    $('#status').hidden = !message;
  }
  function videoItems() {
    const items = state.category === 'songs' ? data.songs : [full];
    return data.hidePending ? items.filter((item) => ready(item, 'video')) : items;
  }
  function renderVideos() {
    $('[data-category=full]').hidden = Boolean(data.hidePending && !ready(full, 'video'));
    const items = videoItems();
    $('#video-count').textContent = `${items.length} ${items.length === 1 ? 'video' : 'videos'}`;
    $('#video-grid').replaceChildren(...items.map((item) => {
      const card = el('article', 'video-card');
      const button = el('button', 'video-select');
      button.type = 'button';
      button.setAttribute('aria-label', `Play ${item.title}`);
      button.disabled = !ready(item, 'video');
      const picture = el('div', 'thumbnail');
      const image = el('img');
      image.src = new URL((item.artworkReady ?? data.artworkReady) ? item.thumbnail || './thumbs/full.jpg' : item.thumbnailFallback || './thumbs/full.jpg', APP_URL).href;
      image.addEventListener('error', () => { image.src = new URL(item.thumbnailFallback || './thumbs/full.jpg', APP_URL).href; }, { once: true });
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 640;
      image.height = 360;
      picture.append(image);
      button.append(picture, el('h2', 'video-title', item.title));
      const meta = el('div', 'video-meta');
      if (item.artist) meta.append(el('span', '', item.artist));
      if (item.number && !item.artist) meta.append(el('span', 'track-number', String(item.number).padStart(2, '0')));
      if (item.duration) meta.append(el('span', '', formatTime(item.duration)));
      if (!ready(item, 'video')) meta.append(el('span', '', 'Updating'));
      if (item.youtubeId) meta.append(el('span', '', 'YouTube'));
      button.append(meta);
      button.addEventListener('click', () => playVideo(item));
      card.append(button);
      return card;
    }));
  }
  function renderAudio() {
    const shown = tracks.filter((item) => item.audio && (!data.hidePending || ready(item, 'audio') || state.saved.has(key(item))) && (state.audioFilter !== 'saved' || state.saved.has(key(item))));
    $('#audio-empty').hidden = shown.length > 0;
    $('#audio-list').replaceChildren(...shown.map((item) => {
      const id = key(item);
      const isSaved = state.saved.has(id);
      const job = state.saving.get(id);
      const row = el('article', `audio-row${state.selected === item ? ' is-playing' : ''}`);
      const play = el('button', 'track-play', state.selected === item && !audio.paused ? 'Ⅱ' : item.number ? String(item.number).padStart(2, '0') : '▶');
      play.setAttribute('aria-label', `${state.selected === item && !audio.paused ? 'Pause' : 'Play'} ${item.title}`);
      play.disabled = !ready(item, 'audio') && !isSaved;
      play.addEventListener('click', () => state.selected === item ? toggleAudio() : playAudio(item));
      const info = el('div', 'track-info');
      info.append(el('h2', 'track-title', item.title));
      const detail = el('div', 'track-detail');
      if (item.artist) detail.append(el('span', '', item.artist));
      if (item.duration) detail.append(el('span', '', formatTime(item.duration)));
      if (isSaved) detail.append(el('span', 'saved-label', 'Saved'));
      else if (!ready(item, 'audio')) detail.append(el('span', '', 'Updating'));
      info.append(detail);
      const actions = el('div', 'track-actions');
      const save = el('button', `quiet offline-button${isSaved ? ' is-saved' : ''}`, job ? `Cancel ${job.progress}%` : isSaved ? 'Remove offline' : 'Save offline');
      save.disabled = !OFFLINE_ENABLED || (!ready(item, 'audio') && !isSaved);
      save.setAttribute('aria-label', `${job ? 'Cancel saving' : isSaved ? 'Remove offline copy of' : 'Save offline'} ${item.title}`);
      save.addEventListener('click', () => toggleOffline(item));
      const download = el('a', 'download', 'Download');
      download.href = media(item.audio);
      download.download = new URL(media(item.audio)).pathname.split('/').pop();
      download.setAttribute('aria-label', `Download ${item.title} audio`);
      download.addEventListener('click', async (event) => {
        if (!ready(item, 'audio') && !isSaved) { event.preventDefault(); return; }
        if (!navigator.onLine && isSaved) {
          event.preventDefault();
          const saved = await savedResponse(await caches.open(AUDIO_CACHE), item);
          if (saved) {
            const url = URL.createObjectURL(await saved.blob());
            const link = el('a'); link.href = url; link.download = new URL(media(item.audio)).pathname.split('/').pop(); link.click();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          }
        }
      });
      if (!ready(item, 'audio') && !isSaved) { download.removeAttribute('href'); download.setAttribute('aria-disabled', 'true'); }
      actions.append(save, download);
      row.append(play, info, actions);
      return row;
    }));
    $('#play-all').disabled = !data.songs.some((song) => ready(song, 'audio') || state.saved.has(key(song)));
  }
  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    $('#videos-view').hidden = mode !== 'videos';
    $('#audio-view').hidden = mode !== 'audio';
    if (mode === 'audio') { closeVideo(); renderAudio(); }
    else renderVideos();
    announce('');
  }
  function closeVideo() {
    video.pause(); video.removeAttribute('src'); video.load();
    $('#youtube').removeAttribute('src');
    $('#video-player').hidden = true;
  }
  function closeAudio() {
    state.playToken += 1;
    audio.pause(); audio.removeAttribute('src'); audio.load();
    state.selected = null;
    if (state.objectURL) { URL.revokeObjectURL(state.objectURL); state.objectURL = null; }
    $('#audio-dock').hidden = true;
    if ('mediaSession' in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; }
    renderAudio();
  }
  function playVideo(item) {
    closeAudio(); closeVideo(); announce('');
    $('#video-player').hidden = false;
    $('#video-title').textContent = item.title;
    const youtubeId = /^[A-Za-z0-9_-]{11}$/.test(item.youtubeId || '') ? item.youtubeId : null;
    video.hidden = Boolean(youtubeId);
    $('#youtube').hidden = !youtubeId;
    $('#youtube-link').hidden = !youtubeId;
    if (youtubeId) {
      $('#youtube').src = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0`;
      $('#youtube-link').href = `https://www.youtube.com/watch?v=${youtubeId}`;
    } else {
      video.src = media(item.video);
      video.poster = new URL((item.artworkReady ?? data.artworkReady) ? item.thumbnail || './thumbs/full.jpg' : item.thumbnailFallback || './thumbs/full.jpg', APP_URL).href;
      video.play().catch((error) => { if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') announce('Video could not load. Try again when connected.'); });
    }
    $('#main').scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  async function playAudio(item) {
    const token = ++state.playToken;
    closeVideo(); audio.pause(); announce('');
    state.selected = item;
    $('#audio-title').textContent = item.title;
    $('#audio-dock').hidden = false;
    let src = media(item.audio);
    let blobURL = null;
    if (state.saved.has(key(item))) {
      try {
        const response = await savedResponse(await caches.open(AUDIO_CACHE), item);
        if (response) { blobURL = URL.createObjectURL(await response.blob()); src = blobURL; }
        else { state.saved.delete(key(item)); renderAudio(); }
      } catch { state.saved.delete(key(item)); }
    }
    if (token !== state.playToken) { if (blobURL) URL.revokeObjectURL(blobURL); return; }
    if (state.objectURL) URL.revokeObjectURL(state.objectURL);
    state.objectURL = blobURL;
    audio.src = src;
    updateMediaSession(item);
    updateTransport();
    renderAudio();
    audio.play().catch((error) => {
      if (error.name === 'NotAllowedError') announce('Tap play in the audio player.');
      else if (error.name !== 'AbortError') announce('Audio could not load. Try again when connected.');
    });
  }
  function toggleAudio() { if (audio.paused) audio.play().catch(() => announce('Tap play in the audio player.')); else audio.pause(); }
  function playableSongs() { return data.songs.filter((song) => navigator.onLine ? ready(song, 'audio') || state.saved.has(key(song)) : state.saved.has(key(song))); }
  function moveTrack(direction, fromEnded = false) {
    if (!state.selected || state.selected === full) return;
    if (direction < 0 && audio.currentTime > 3 && !fromEnded) { audio.currentTime = 0; return; }
    const queue = playableSongs();
    const index = queue.indexOf(state.selected);
    const item = queue[index + direction];
    if (item) playAudio(item);
  }
  function updateTransport() {
    const queue = playableSongs();
    const index = queue.indexOf(state.selected);
    $('#previous').disabled = index < 0;
    $('#next').disabled = index < 0 || index >= queue.length - 1;
  }
  function updateMediaSession(item) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: item.title, artist: data.artist || 'Caceta de Golira', album: 'Sonidos 2025', artwork: (item.artworkReady ?? data.artworkReady) && item.artwork ? [{ src: new URL(item.artwork, APP_URL).href, sizes: '1000x1000', type: 'image/webp' }, { src: new URL('./icons/icon-512.png?v=logo-20260921', APP_URL).href, sizes: '512x512', type: 'image/png' }] : [{ src: new URL('./icons/icon-512.png?v=logo-20260921', APP_URL).href, sizes: '512x512', type: 'image/png' }] });
    const handlers = { play: () => audio.play(), pause: () => audio.pause(), previoustrack: () => moveTrack(-1), nexttrack: () => moveTrack(1), seekbackward: (event) => { audio.currentTime = Math.max(0, audio.currentTime - (event.seekOffset || 10)); }, seekforward: (event) => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (event.seekOffset || 10)); }, seekto: (event) => { if (Number.isFinite(event.seekTime)) audio.currentTime = event.seekTime; }, stop: closeAudio };
    for (const [name, handler] of Object.entries(handlers)) { try { navigator.mediaSession.setActionHandler(name, handler); } catch {} }
  }
  function positionState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) }); } catch {}
  }
  async function refreshSaved() {
    if (!OFFLINE_ENABLED) return;
    try {
      const cache = await caches.open(AUDIO_CACHE);
      const keys = new Set((await cache.keys()).map((request) => request.url));
      state.saved = new Set(tracks.filter((item) => offlineURLs(item).some((url) => keys.has(url))).map(key));
      renderAudio();
    } catch { announce('Offline storage is unavailable in this browser. Downloads still work.'); }
  }
  async function toggleOffline(item) {
    const id = key(item);
    const running = state.saving.get(id);
    if (running) { running.controller.abort(); return; }
    let cache;
    try { cache = await caches.open(AUDIO_CACHE); } catch { announce('Offline storage is unavailable. Download the file instead.'); return; }
    const url = media(item.audio);
    if (state.saved.has(id)) {
      await Promise.all(offlineURLs(item).map((savedURL) => cache.delete(savedURL)));
      state.saved.delete(id); renderAudio(); announce(''); return;
    }
    const controller = new AbortController();
    const job = { controller, progress: 0 };
    state.saving.set(id, job); renderAudio(); announce('');
    try {
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const type = response.headers.get('content-type') || '';
      if (type.includes('text/') || type.includes('json')) throw new Error('unavailable');
      const size = Number(response.headers.get('content-length'));
      if (navigator.storage?.estimate && size) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && size * 1.2 > estimate.quota - (estimate.usage || 0)) throw new DOMException('Storage full', 'QuotaExceededError');
      }
      let loaded = 0;
      if (response.body && 'TransformStream' in window) {
        const meter = new TransformStream({
          transform(chunk, stream) {
            if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            loaded += chunk.byteLength;
            const progress = size ? Math.min(99, Math.floor(loaded / size * 100)) : 0;
            if (progress !== job.progress) { job.progress = progress; renderAudio(); }
            stream.enqueue(chunk);
          },
          flush() { if (!loaded || (size && loaded !== size)) throw new Error('incomplete'); }
        });
        await cache.put(url, new Response(response.body.pipeThrough(meter), { headers: response.headers }));
      } else {
        const blob = await response.blob();
        if (!blob.size || (size && blob.size !== size)) throw new Error('incomplete');
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        await cache.put(url, new Response(blob, { headers: response.headers }));
      }
      if (controller.signal.aborted) { await cache.delete(url); throw new DOMException('Aborted', 'AbortError'); }
      state.saved.add(id);
    } catch (error) {
      if (error.name !== 'AbortError') announce(error.name === 'QuotaExceededError' ? 'Storage is full. Remove a saved song or download the file instead.' : 'Could not save this song. Check your connection and try again.');
    } finally { state.saving.delete(id); renderAudio(); }
  }
  document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
    state.category = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    renderVideos();
  }));
  document.querySelectorAll('[data-audio-filter]').forEach((button) => button.addEventListener('click', () => {
    state.audioFilter = button.dataset.audioFilter;
    document.querySelectorAll('[data-audio-filter]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    renderAudio();
  }));
  $('#close-video').addEventListener('click', closeVideo);
  $('#close-audio').addEventListener('click', closeAudio);
  $('#previous').addEventListener('click', () => moveTrack(-1));
  $('#next').addEventListener('click', () => moveTrack(1));
  $('#play-all').addEventListener('click', () => { const first = playableSongs()[0]; if (first) playAudio(first); });
  audio.addEventListener('ended', () => moveTrack(1, true));
  for (const name of ['play', 'pause']) audio.addEventListener(name, () => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
    $('.now-label').textContent = audio.paused ? 'Paused' : 'Playing'; renderAudio();
  });
  for (const name of ['timeupdate', 'durationchange', 'ratechange', 'seeked']) audio.addEventListener(name, positionState);
  audio.addEventListener('error', () => { if (state.selected && audio.getAttribute('src')) announce('Audio could not load. Check your connection or use a saved song.'); });
  video.addEventListener('error', () => { if (video.getAttribute('src')) announce('Video could not load. Check your connection and try again.'); });
  window.addEventListener('online', () => { updateTransport(); announce(''); });
  window.addEventListener('offline', updateTransport);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSaved(); });
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); state.deferredInstall = event; $('#install').hidden = false; });
  $('#install').addEventListener('click', async () => {
    if (state.deferredInstall) { await state.deferredInstall.prompt(); state.deferredInstall = null; $('#install').hidden = true; }
  });
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let dismissed = false; try { dismissed = localStorage.getItem('sonidos-install-dismissed') === '1'; } catch {}
  $('#install-help').hidden = !(ios && !matchMedia('(display-mode: standalone)').matches && !navigator.standalone && !dismissed);
  $('#dismiss-install').addEventListener('click', () => { $('#install-help').hidden = true; try { localStorage.setItem('sonidos-install-dismissed', '1'); } catch {} });
  renderVideos(); renderAudio(); refreshSaved();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register(new URL('./sw.js', APP_URL), { scope: APP_URL.pathname }).catch(() => {});
})();
