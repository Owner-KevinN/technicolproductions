import { openDetail } from './dialog.js';

let manifestRequest;

function button(text) {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'button secondary compact';
  control.textContent = text;
  return control;
}

function makeReader(documentInfo) {
  const body = document.createElement('div');
  body.className = 'resume-reader';
  const controls = document.createElement('div');
  controls.className = 'resume-actions';
  const original = document.createElement('a');
  original.className = 'button secondary compact';
  original.href = documentInfo.pdf;
  original.target = '_blank';
  original.rel = 'noopener';
  original.textContent = 'Open Original PDF';
  const download = document.createElement('a');
  download.className = 'button primary compact';
  download.href = documentInfo.pdf;
  download.download = documentInfo.downloadFilename;
  download.textContent = 'Download PDF';
  const zoom = button('Zoom to 2×');
  zoom.setAttribute('aria-pressed', 'false');
  const label = document.createElement('label');
  label.className = 'resume-page-select';
  label.textContent = 'Page';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Resume Page');
  label.append(select);
  controls.append(original, download, zoom, label);

  const viewport = document.createElement('div');
  viewport.className = 'resume-pages';
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-label', documentInfo.title + ', Scrollable Preview');
  const pages = document.createElement('div');
  pages.className = 'resume-page-stack';
  const figures = [];
  for (const page of documentInfo.pages) {
    const option = document.createElement('option');
    option.value = page.page;
    option.textContent = page.page + ' of ' + documentInfo.pageCount;
    select.append(option);
    const figure = document.createElement('figure');
    figure.className = 'resume-page';
    const image = document.createElement('img');
    image.src = page.src;
    image.alt = documentInfo.title + ', Page ' + page.page + ' of ' + documentInfo.pageCount;
    image.decoding = 'async';
    image.loading = page.page === 1 ? 'eager' : 'lazy';
    if (page.width && page.height) {
      image.width = page.width;
      image.height = page.height;
    }
    const caption = document.createElement('figcaption');
    caption.textContent = 'Page ' + page.page + ' of ' + documentInfo.pageCount;
    const error = document.createElement('p');
    error.className = 'resume-page-error';
    error.hidden = true;
    error.textContent = 'This preview page could not load. Use Open Original PDF or Download PDF above.';
    error.setAttribute('role', 'status');
    image.addEventListener('error', () => { error.hidden = false; });
    figure.append(image, caption, error);
    pages.append(figure);
    figures.push(figure);
  }
  viewport.append(pages);
  zoom.addEventListener('click', () => {
    const wasZoomed = viewport.classList.contains('is-zoomed');
    const factor = wasZoomed ? .5 : 2;
    const x = viewport.scrollLeft + viewport.clientWidth / 2;
    const y = viewport.scrollTop + viewport.clientHeight / 2;
    viewport.classList.toggle('is-zoomed', !wasZoomed);
    zoom.textContent = wasZoomed ? 'Zoom to 2×' : 'Fit to Width';
    zoom.setAttribute('aria-pressed', String(!wasZoomed));
    viewport.scrollLeft = x * factor - viewport.clientWidth / 2;
    viewport.scrollTop = y * factor - viewport.clientHeight / 2;
  });
  select.addEventListener('change', () => {
    const figure = figures[Number(select.value) - 1];
    const target = figure.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
    viewport.scrollTo({top: target, left: 0});
  });
  body.append(controls, viewport);
  return body;
}

for (const preview of document.querySelectorAll('[data-resume]')) {
  preview.addEventListener('click', async event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    preview.setAttribute('aria-busy', 'true');
    try {
      manifestRequest ??= fetch(new URL('../docs/resumes.json', import.meta.url))
        .then(response => {
          if (!response.ok) throw new Error('Resume manifest unavailable');
          return response.json();
        });
      const {documents} = await manifestRequest;
      const documentInfo = documents.find(document => document.id === preview.dataset.resume);
      if (!documentInfo) throw new Error('Resume unavailable');
      openDetail(documentInfo.title, makeReader(documentInfo), preview, 'media-lightbox');
    } catch {
      manifestRequest = undefined;
      location.assign(preview.href);
    } finally {
      preview.removeAttribute('aria-busy');
    }
  });
}
