import { openDetail } from './dialog.js';

function control(text, classes = 'button secondary') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = classes;
  button.textContent = text;
  return button;
}

export function openPhotoLightbox(items, startIndex, trigger) {
  let index = startIndex;
  let zoomed = false;
  const body = document.createElement('div');
  body.className = 'photo-lightbox';
  const viewport = document.createElement('div');
  viewport.className = 'photo-viewport';
  const caption = document.createElement('p');
  caption.className = 'photo-caption';
  caption.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div');
  actions.className = 'actions photo-actions';
  const previous = control('Previous Photo');
  const next = control('Next Photo');
  const zoom = control('Zoom to 2×');
  const fullSize = document.createElement('a');
  fullSize.className = 'button text-button';
  fullSize.textContent = 'Open Original Image';
  fullSize.target = '_blank';
  fullSize.rel = 'noopener';
  if (items.length > 1) actions.append(previous, next);
  actions.append(zoom, fullSize);
  body.append(actions, caption, viewport);

  let image;
  let pressTarget;
  function toggleZoom(event) {
    const bounds = image.getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    const x = event.currentTarget === pressTarget
      ? event.clientX - view.left : viewport.clientWidth / 2;
    const y = event.currentTarget === pressTarget
      ? event.clientY - view.top : Math.min(viewport.clientHeight / 2, bounds.height / 2);
    const imageX = (viewport.scrollLeft + x) / image.offsetWidth;
    const imageY = (viewport.scrollTop + y) / image.offsetHeight;
    zoomed = !zoomed;
    viewport.classList.toggle('is-zoomed', zoomed);
    zoom.textContent = zoomed ? 'Zoom to 1×' : 'Zoom to 2×';
    pressTarget.title = zoom.textContent;
    pressTarget.setAttribute('aria-label', 'Newspaper Image: ' + zoom.textContent);
    viewport.scrollLeft = imageX * image.offsetWidth - x;
    viewport.scrollTop = imageY * image.offsetHeight - y;
  }

  function updatePhoto() {
    const item = items[index];
    const isPress = Boolean(item.is_press_clipping);
    viewport.className = isPress ? 'photo-viewport press-viewport' : 'photo-viewport';
    viewport.tabIndex = isPress ? 0 : -1;
    viewport.setAttribute('aria-label', isPress ? 'Scrollable Newspaper Page' : 'Full-Size Photograph');
    image = document.createElement('img');
    image.src = item.src;
    image.alt = item.alt || item.title || '';
    image.decoding = 'async';
    if (item.width && item.height) {
      image.width = item.width;
      image.height = item.height;
    }
    zoomed = false;
    zoom.hidden = !isPress;
    zoom.textContent = 'Zoom to 2×';
    pressTarget = null;
    if (isPress) {
      pressTarget = control('', 'press-page');
      pressTarget.tabIndex = -1;
      pressTarget.title = 'Zoom to 2×';
      pressTarget.setAttribute('aria-label', 'Newspaper Image: Zoom to 2×');
      pressTarget.append(image);
      pressTarget.addEventListener('click', toggleZoom);
    }
    viewport.replaceChildren(pressTarget || image);
    viewport.scrollTo(0, 0);
    caption.textContent = (items.length > 1 ? index + 1 + ' of ' + items.length + ' · ' : '')
      + (item.description || item.caption || item.alt);
    fullSize.href = item.src;
    const heading = item.shorthandTitle || item.title || 'Portfolio Photo';
    document.querySelector('#detail-title').textContent = heading;
    return heading;
  }

  function step(offset) {
    index = (index + offset + items.length) % items.length;
    updatePhoto();
  }
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  zoom.addEventListener('click', toggleZoom);
  const heading = updatePhoto();
  openDetail(heading, body, trigger, 'media-lightbox');
}
