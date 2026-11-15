const dialog = document.querySelector('#detail-dialog');
const title = document.querySelector('#detail-title');
const content = document.querySelector('#detail-content');
const closeButton = document.querySelector('#close-detail');
let returnFocus;

export function openDetail(heading, body, trigger, mode = '') {
  dialog.classList.toggle('media-lightbox', mode === 'media-lightbox');
  title.textContent = heading;
  content.replaceChildren(body);
  returnFocus = trigger;
  dialog.showModal();
  closeButton.focus();
}

closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  content.replaceChildren();
  dialog.classList.remove('media-lightbox');
  returnFocus?.focus();
  returnFocus = undefined;
});

dialog.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')]
    .filter((element) => !element.hidden && element.getClientRects().length);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

for (const preview of document.querySelectorAll('[data-pdf]')) {
  preview.addEventListener('click', (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault();

    const documentTitle = preview.dataset.pdfTitle || preview.closest('article')?.querySelector('h3')?.textContent || 'PDF Preview';
    const fragment = document.createDocumentFragment();
    const actions = document.createElement('div');
    actions.className = 'actions';

    const direct = document.createElement('a');
    direct.href = preview.href;
    direct.target = '_blank';
    direct.rel = 'noopener';
    direct.className = 'button secondary';
    direct.textContent = 'Open PDF in a New Tab';

    const download = document.createElement('a');
    download.href = preview.href;
    download.download = '';
    download.className = 'button text-button';
    download.textContent = 'Download PDF';
    actions.append(direct, download);

    const viewer = document.createElement('object');
    viewer.className = 'pdf-preview';
    viewer.type = 'application/pdf';
    viewer.data = preview.href;
    viewer.tabIndex = -1;
    viewer.setAttribute('aria-label', documentTitle + ' PDF preview');
    const fallback = document.createElement('p');
    fallback.textContent = 'Open or download the PDF using the links above.';
    viewer.append(fallback);
    fragment.append(actions, viewer);
    openDetail(documentTitle, fragment, preview);
  });
}
