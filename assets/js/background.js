import { openPhotoLightbox } from './lightbox.js';

const show = document.querySelector('#background-show');
const controls = document.querySelector('#background-inspect');
const playback = document.querySelector('#background-play');
const info = document.querySelector('#background-info');
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const transitions = ['ken-burns', 'stage-wipe', 'documentary', 'spotlight'];

export async function startBackground() {
  const response = await fetch(new URL('../../technicol-background-slideshows.json', import.meta.url));
  if (!response.ok) throw new Error('Background manifest could not load');
  const { slideshows, openingSlideId } = await response.json();
  const pool = slideshows.flatMap((chapter, chapterIndex) => {
    const photos = new Map(chapter.selectedImages.map(photo => [photo.id, photo]));
    return chapter.slides.map(slide => ({
      ...slide,
      effect: transitions[chapterIndex],
      transitionMs: chapter.transition.durationMs,
      photos: slide.tiles.map(({ photoId }) => photos.get(photoId)),
    }));
  });

  const opening = pool.find(slide => slide.id === openingSlideId);
  if (!opening) throw new Error('Opening slide is missing');
  const rest = pool.filter(slide => slide.id !== openingSlideId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const slides = [opening, ...rest];

  let current;
  let ready;
  let timer = null;
  let started = 0;
  let remaining = 0;
  let isPlaying = true;

  function renderControl() {
    playback.textContent = isPlaying ? 'Pause' : 'Play';
    show.classList.toggle('is-paused', !isPlaying || document.hidden);
  }

  function stopTimer() {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
    remaining = Math.max(0, remaining - (performance.now() - started));
  }

  function arm() {
    if (!isPlaying || document.hidden || timer !== null || !current) return;
    if (remaining === 0) {
      if (ready) advance();
      return;
    }
    started = performance.now();
    timer = window.setTimeout(() => {
      timer = null;
      remaining = 0;
      if (ready && isPlaying && !document.hidden) advance();
    }, remaining);
  }

  function setPaused(value) {
    isPlaying = !value;
    renderControl();
    if (!isPlaying) stopTimer();
    else arm();
  }

  function inspect(frame, index, trigger) {
    setPaused(true);
    openPhotoLightbox(frame.photos, index, trigger);
  }

  function render(index) {
    const slide = slides[index];
    const photos = slide.photos.map(photo => ({
      ...photo, src: photo.currentPath, width: photo.dimensionsPx.width, height: photo.dimensionsPx.height,
      alt: photo.title || photo.shorthandTitle,
    }));
    const builtIn = index === 0 && !current ? show.querySelector('[data-opening-frame]') : null;
    const node = builtIn || document.createElement('div');
    node.dataset.slideId = slide.id;
    node.className = 'background-frame ' + slide.effect + (slide.type === 'collage' ? ' background-collage' : ' background-hero');
    node.style.setProperty('--transition-time', slide.transitionMs + 'ms');
    node.style.setProperty('--hold-time', slide.durationMs + 'ms');
    const pending = [];
    photos.forEach((photo, i) => {
      const tile = builtIn?.querySelector('button') || document.createElement('button');
      tile.disabled = false;
      tile.type = 'button';
      tile.className = 'background-tile';
      tile.setAttribute('aria-label', 'Inspect ' + photo.alt.replaceAll('_', ' '));
      const image = builtIn?.querySelector('img') || document.createElement('img');
      image.alt = '';
      image.decoding = 'async';
      image.width = photo.width;
      image.height = photo.height;
      const focus = photo.objectPositionPercent;
      if (focus) image.style.objectPosition = focus.x + '% ' + focus.y + '%';
      if (!builtIn) image.src = photo.src;
      pending.push(image.decode());
      const frame = { photos };
      tile.addEventListener('click', () => inspect(frame, i, tile));
      if (!builtIn) { tile.append(image); node.append(tile); }
    });
    return { index, slide, node, photos, pending };
  }

  async function prepare(from) {
    for (let offset = 0; offset < slides.length; offset++) {
      const index = (from + offset) % slides.length;
      if (index === current?.index) continue;
      const frame = render(index);
      let decodingTimeout;
      try {
        await Promise.race([
          Promise.all(frame.pending),
          new Promise((_, reject) => {
            decodingTimeout = window.setTimeout(() => reject(new Error('Background image decode timed out')), 30000);
          }),
        ]);
      } catch {
        continue;
      } finally {
        window.clearTimeout(decodingTimeout);
      }
      ready = frame;
      if (!current) advance();
      else arm();
      return;
    }
  }

  function advance() {
    const outgoing = current?.node;
    if (outgoing) {
      outgoing.inert = true;
      outgoing.classList.add('is-outgoing');
      outgoing.setAttribute('aria-hidden', 'true');
    }
    current = ready;
    ready = undefined;
    remaining = current.slide.durationMs;
    show.hidden = false;
    controls.hidden = false;
    if (outgoing && !motion.matches) current.node.classList.add('is-entering');
    show.append(current.node);
    if (outgoing) window.setTimeout(() => outgoing.remove(), motion.matches ? 0 : current.slide.transitionMs + 50);
    renderControl();
    void prepare((current.index + 1) % slides.length);
    arm();
  }

  show.addEventListener('focusin', () => setPaused(true));
  info.addEventListener('click', () => {
    if (current) inspect(current, 0, info);
  });
  playback.addEventListener('click', () => setPaused(isPlaying));
  document.addEventListener('visibilitychange', () => {
    renderControl();
    if (document.hidden) stopTimer();
    else arm();
  });
  current = render(0);
  if (!current.node.isConnected) show.append(current.node);
  Promise.allSettled(current.pending);
  remaining = current.slide.durationMs;
  controls.hidden = false;
  renderControl();
  void prepare(1);
  arm();
}
