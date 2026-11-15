function embedUrl(provider, source) {
  const url = new URL(source);
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (provider === 'youtube' && ['youtube.com','m.youtube.com','youtube-nocookie.com','youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? parts[0] : url.searchParams.get('v') || parts[1];
    if (/^[\w-]{11}$/.test(id || '')) return 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1';
  }
  if (provider === 'vimeo' && ['vimeo.com','player.vimeo.com'].includes(host)) {
    const i = parts.findIndex(part => /^\d+$/.test(part));
    if (i < 0) return null;
    const hash = url.searchParams.get('h') || parts[i + 1];
    const unlisted = hash && /^[\da-z]+$/i.test(hash) ? '&h=' + hash : '';
    return 'https://player.vimeo.com/video/' + parts[i] + '?autoplay=1' + unlisted;
  }
  return null;
}

function localPlayer(entry) {
  const video = document.createElement('video');
  video.controls = true;
  video.playsInline = true;
  video.preload = 'none';
  video.src = entry.src;
  if (entry.poster) video.poster = entry.poster;
  video.setAttribute('aria-label', entry.title);
  if (entry.captions) {
    const track = document.createElement('track');
    track.kind = 'captions';
    track.src = entry.captions;
    track.srclang = 'en';
    track.label = 'English';
    video.append(track);
  }
  return video;
}

function externalPlayer(entry) {
  const embed = embedUrl(entry.provider, entry.url);
  if (!embed) throw new Error('Unsupported video URL');
  const shell = document.createElement('div');
  shell.className = 'external-video';
  if (entry.poster) {
    const cover = document.createElement('img');
    cover.src = entry.poster;
    cover.alt = '';
    cover.loading = 'lazy';
    shell.append(cover);
  }
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'button primary';
  play.textContent = 'Play ' + (entry.provider === 'youtube' ? 'YouTube' : 'Vimeo') + ' Video';
  play.setAttribute('aria-label', 'Play ' + entry.title);
  play.addEventListener('click', () => {
    const player = document.createElement('iframe');
    player.src = embed;
    player.title = entry.title;
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.allowFullscreen = true;
    shell.append(player);
    play.hidden = true;
    player.focus();
  });
  shell.addEventListener('resetplayer', () => {
    shell.querySelector('iframe')?.remove();
    play.hidden = false;
  });
  shell.append(play);
  return shell;
}

export async function mountVideos(container, category = null) {
  const response = await fetch(new URL('../portfolio/videos-manifest.json', import.meta.url));
  if (!response.ok) throw new Error('Video manifest could not load');
  const { videos } = await response.json();
  const grid = document.createElement('div');
  grid.className = 'video-grid';
  for (const entry of videos) {
    if (category && entry.category !== category) continue;
    const card = document.createElement('article');
    card.className = 'video-item';
    const title = document.createElement('h3');
    title.textContent = entry.title;
    const description = document.createElement('p');
    description.textContent = entry.description;
    const credits = document.createElement('p');
    credits.textContent = entry.credits ?? '';
    const link = document.createElement('a');
    const local = entry.provider === 'local';
    link.href = local ? entry.src : entry.url;
    link.textContent = local ? 'Open Video File' : 'Open on ' + (entry.provider === 'youtube' ? 'YouTube' : 'Vimeo');
    try {
      card.append(title, local ? localPlayer(entry) : externalPlayer(entry), description, credits, link);
      grid.append(card);
    } catch {
      // A malformed external entry leaves the other videos available.
    }
  }
  container.replaceChildren(grid);
}

export function stopVideos(container) {
  for (const video of container.querySelectorAll('video')) video.pause();
  for (const player of container.querySelectorAll('.external-video')) player.dispatchEvent(new Event('resetplayer'));
}
