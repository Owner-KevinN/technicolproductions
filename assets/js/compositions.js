function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label) {
  const node = element('button', 'button secondary compact', label);
  node.type = 'button';
  return node;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const time = Math.floor(seconds);
  return Math.floor(time / 60) + ':' + String(time % 60).padStart(2, '0');
}

function mountPlayer(container, tracks, players) {
  const audio = element('audio');
  audio.preload = 'none';
  players.push(audio);
  const current = element('p', 'music-current');
  current.setAttribute('aria-live', 'polite');
  const controls = element('div', 'music-controls');
  const previous = button('Previous');
  const toggle = button('Play');
  const next = button('Next');
  controls.append(previous, toggle, next);

  const timeline = element('div', 'music-timeline');
  const elapsed = element('span', '', '0:00');
  elapsed.setAttribute('aria-hidden', 'true');
  const scrubber = element('input');
  scrubber.type = 'range';
  scrubber.min = 0;
  scrubber.max = 0;
  scrubber.step = 1;
  scrubber.value = 0;
  scrubber.disabled = true;
  scrubber.setAttribute('aria-label', 'Playback Position');
  const duration = element('span', '', '0:00');
  duration.setAttribute('aria-hidden', 'true');
  timeline.append(elapsed, scrubber, duration);

  const status = element('p', 'music-status');
  status.setAttribute('role', 'status');
  const list = element('ol', 'music-tracklist');
  const available = tracks.flatMap((track, index) => track.src ? [index] : []);
  const selectors = new Map();
  let selected = available[0] ?? -1;
  let loaded = -1;
  let request = 0;

  tracks.forEach((track, index) => {
    const row = element('li');
    if (track.src) {
      const select = button(track.title);
      select.className = 'music-track-button';
      select.addEventListener('click', () => {
        if (selected === index && !audio.paused) pause();
        else void play(index);
      });
      row.append(select);
      selectors.set(index, select);
    } else {
      row.className = 'music-track-pending';
      row.append(element('span', '', track.title), element('span', 'music-pending-badge', 'Archival Master Pending Upload'));
    }
    list.append(row);
  });

  function updateControls() {
    const i = available.indexOf(selected);
    previous.disabled = i <= 0;
    next.disabled = i < 0 || i >= available.length - 1;
    toggle.disabled = i < 0;
    toggle.textContent = audio.paused ? 'Play' : 'Pause';
    for (const [index, selector] of selectors) {
      if (index === selected) selector.setAttribute('aria-current', 'true');
      else selector.removeAttribute('aria-current');
    }
  }

  function updateTrack() {
    current.textContent = selected < 0 ? 'Archival Masters Pending Upload'
      : 'Track ' + (selected + 1) + ' of ' + tracks.length + ' · ' + tracks[selected].title;
    updateControls();
  }

  function syncTimeline() {
    const ready = Number.isFinite(audio.duration) && audio.duration > 0;
    scrubber.disabled = !ready;
    scrubber.max = ready ? audio.duration : 0;
    scrubber.value = ready ? audio.currentTime : 0;
    elapsed.textContent = formatTime(ready ? audio.currentTime : 0);
    duration.textContent = formatTime(audio.duration);
    scrubber.setAttribute('aria-valuetext', elapsed.textContent + ' of ' + duration.textContent);
  }

  function pause() {
    request++;
    audio.pause();
  }

  async function play(index) {
    if (index < 0) return;
    const attempt = ++request;
    selected = index;
    if (loaded !== index || audio.error) {
      loaded = index;
      audio.src = tracks[index].src;
      audio.load();
      syncTimeline();
    }
    status.textContent = '';
    updateTrack();
    try {
      await audio.play();
    } catch (error) {
      if (request === attempt && error.name !== 'AbortError') {
        status.textContent = 'This track could not play. Try again or choose another track.';
      }
    }
  }

  function step(offset) {
    const index = available[available.indexOf(selected)+offset];
    if (index !== undefined) void play(index);
  }

  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  toggle.addEventListener('click', () => {
    if (audio.paused) void play(selected);
    else pause();
  });
  scrubber.addEventListener('input', () => {
    if (!scrubber.disabled) audio.currentTime = scrubber.valueAsNumber;
  });
  audio.addEventListener('play', () => {
    for (const player of players) if (player !== audio) player.pause();
    updateControls();
  });
  audio.addEventListener('pause', updateControls);
  audio.addEventListener('ended', () => {
    updateControls();
    step(1);
  });
  for (const name of ['timeupdate','durationchange','emptied']) audio.addEventListener(name, syncTimeline);
  audio.addEventListener('error', () => {
    status.textContent = 'This track could not load. Try again or choose another track.';
    updateControls();
  });
  updateTrack();
  container.replaceChildren(audio, current, controls, timeline, status, list);
}

export function startCompositions() {
  const studio = document.querySelector('#studio-player');
  const score = document.querySelector('#score-player');
  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    for (const target of [studio,score]) target.setAttribute('aria-busy','true');
    try {
      const response = await fetch(new URL('../audio/audio-manifest.json',import.meta.url));
      if (!response.ok) throw new Error('Playlist unavailable');
      const manifest = await response.json();
      if (manifest.mastersReady === false) {
        studio.replaceChildren(element('p','music-status','Local studio masters are pending.'));
        score.replaceChildren(element('p','music-status','Local score masters are pending.'));
        return;
      }
      const players = [];
      mountPlayer(studio,manifest.studio,players);
      mountPlayer(score,manifest.score,players);
    } catch {
      loading = false;
      for (const target of [studio,score]) {
        const retry = button('Reload Playlist');
        retry.addEventListener('click', load);
        target.replaceChildren(element('p','music-status','The playlist could not load.'),retry);
      }
    } finally {
      for (const target of [studio,score]) target.removeAttribute('aria-busy');
    }
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void load();
    }, {rootMargin:'300px'});
    observer.observe(document.querySelector('#compositions'));
  } else {
    void load();
  }
}

export async function openAboutPhoto(trigger) {
  const [{openPhotoLightbox}, response] = await Promise.all([
    import('./lightbox.js'), fetch(new URL('../portfolio/portfolio-manifest.json', import.meta.url)),
  ]);
  if (!response.ok) throw new Error('Photo details unavailable');
  const { sections } = await response.json();
  const photo = sections.flatMap(({groups})=>groups).find(group=>group.id==='eagles-backstage')?.photos[0];
  if (!photo) throw new Error('Photo details unavailable');
  openPhotoLightbox([photo],0,trigger);
}
