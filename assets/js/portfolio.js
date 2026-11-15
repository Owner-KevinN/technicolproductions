import { openPhotoLightbox } from './lightbox.js';
import { mountVideos, stopVideos } from './videos.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label, className = 'button secondary') {
  const node = element('button', className, label);
  node.type = 'button';
  return node;
}

function picture({ src, alt, width, height }, lazy = false) {
  const img = element('img');
  img.src = src;
  img.alt = alt;
  if (width && height) {
    img.width = width;
    img.height = height;
  }
  if (lazy) img.loading = 'lazy';
  img.decoding = 'async';
  return img;
}

function musicCollection(isScore) {
  const link = element('a', 'button secondary', isScore ? 'Open the Documentary Score Player' : 'Open Original Compositions');
  link.href = isScore ? '#compositions-score' : '#compositions';
  return link;
}

export async function mountPictures(container) {
  const response = await fetch(new URL('../portfolio/portfolio-manifest.json', import.meta.url));
  if (!response.ok) throw new Error('Portfolio manifest request failed');
  const { sections, pressHighlight } = await response.json();
  const categories = element('div', 'archive-sections');
  const results = element('div', 'portfolio-results');
  const resultsTitle = element('h3');
  resultsTitle.id = 'collection-title';
  resultsTitle.tabIndex = -1;
  const resultsStatus = element('p');
  resultsStatus.setAttribute('role', 'status');
  const gallery = element('div');
  const extras = element('div');
  const tools = element('div', 'gallery-tools');
  const label = element('label', '', 'Search the photo archive');
  const search = element('input');
  search.type = 'search';
  label.append(search);
  const clear = button('Clear Search');
  const back = button('Back to Collections');
  tools.append(label, clear, back);
  results.setAttribute('aria-labelledby', resultsTitle.id);
  results.hidden = true;
  results.append(resultsTitle, tools, resultsStatus, gallery, extras);

  const allPhotos = sections.flatMap(({ title, groups }) => groups.flatMap((group) =>
    group.photos.map((photo) => ({ ...photo, searchTitle: title + ' ' + group.title }))));
  const pressPhotos = allPhotos.filter(photo => photo.is_press_clipping);
  const highlight = element('section', 'press-highlight');
  highlight.append(element('h3', '', pressHighlight.title),
    element('p', '', 'Omaha World-Herald · August 28, 2011'));
  const pages = element('div', 'press-pages');
  pressPhotos.forEach((item, index) => {
    const trigger = button('Read Page ' + item.pressPage);
    trigger.addEventListener('click', () => openPhotoLightbox(pressPhotos, index, trigger));
    pages.append(trigger);
  });
  highlight.append(pages);
  const selection = new Map();
  let activeGroup;

  function renderPhotos() {
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const items = terms.length ? allPhotos.filter((item) => {
      const searchable = [item.title, item.alt, item.description || item.caption, item.searchTitle].join(' ').toLowerCase();
      return terms.every((term) => searchable.includes(term));
    }) : activeGroup.photos;
    resultsStatus.textContent = terms.length
      ? items.length + (items.length === 1 ? ' matching photo' : ' matching photos')
      : items.length > 0 ? items.length + ' photos' : '';
    extras.hidden = terms.length > 0;
    gallery.replaceChildren();
    if (terms.length && items.length === 0) gallery.append(element('p', '', 'No photos match that search.'));
    if (!items.length) return;
    const list = element('ul', 'gallery-grid');
    items.forEach((item, index) => {
      const cell = element('li');
      const trigger = button('', 'photo-trigger');
      const preview = picture({ ...item, src: item.thumb }, true);
      if (item.is_press_clipping) preview.className = 'press-preview';
      trigger.append(preview);
      trigger.setAttribute('aria-label', 'View Photo: ' + item.title);
      trigger.addEventListener('click', () => openPhotoLightbox(items, index, trigger));
      cell.append(trigger);
      list.append(cell);
    });
    gallery.append(list);
  }

  function openCollection(group) {
    activeGroup = group;
    for (const [id, control] of selection) control.setAttribute('aria-pressed', String(id === group.id));
    results.hidden = false;
    resultsTitle.textContent = group.title;
    search.value = '';
    extras.replaceChildren();
    if (group.id.startsWith('07')) extras.append(musicCollection(group.id === '07b'));
    if (group.id === '01d') {
      const feature = element('section', 'misc-video-feature');
      const listing = element('div');
      feature.append(element('h4', '', 'Misc Videos'), listing);
      extras.append(feature);
      mountVideos(listing, 'Misc').catch(() => {
        const fallback = element('a', '', 'Watch the Nebraska Regional Poison Control Center Commercial');
        fallback.href = 'https://www.youtube.com/watch?v=PRAMCjP3NI8';
        listing.replaceChildren(fallback);
      });
    }
    renderPhotos();
    resultsTitle.focus();
  }

  for (const section of sections) {
    const category = element('section', 'archive-section');
    const coverFrame = element('div', 'archive-cover');
    const cover = picture({ src: section.cover, alt: '' }, true);
    if (section.cover.endsWith('.png')) cover.className = 'logo-cover';
    coverFrame.append(cover);
    const list = element('ul');
    for (const group of section.groups) {
      const item = element('li');
      const control = button('');
      const preview = element('span', 'subgrid-preview');
      const sample = group.photos[0];
      preview.append(picture({ src: sample?.thumb || section.cover, alt: '' }, true));
      control.append(preview, element('span', '', group.title));
      control.setAttribute('aria-pressed', 'false');
      control.addEventListener('click', () => openCollection(group));
      selection.set(group.id, control);
      item.append(control);
      list.append(item);
    }
    category.append(coverFrame, element('h3', '', section.title), list);
    categories.append(category);
  }

  search.addEventListener('input', renderPhotos);
  clear.addEventListener('click', () => {
    search.value = '';
    renderPhotos();
    search.focus();
  });
  back.addEventListener('click', () => selection.get(activeGroup.id).focus());
  container.addEventListener('portfolio-hidden', () => stopVideos(container));
  container.replaceChildren(highlight, categories, results);
}
