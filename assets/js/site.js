import './dialog.js';
import { startMediaTabs } from './media-tabs.js';
import { startCompositions, openAboutPhoto } from './compositions.js';

document.documentElement.classList.add('js');

const menu = document.querySelector('#menu-toggle');
const nav = document.querySelector('#primary-nav');
const navLinks = [...nav.querySelectorAll('a')];
const home = document.querySelector('.brand');
const legacyDestinations = new Map([
  ['#capabilities', '#disciplines'], ['#career', '#experience'],
  ['#field-notes', '#experience'], ['#portfolio', '#work'],
  ['#resumes', '#documents'], ['#booking', '#dispatch'],
]);

function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
}

function updateActiveLink() {
  const current = location.hash || '#home';
  for (const link of [home, ...navLinks]) {
    if (link.hash === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

function resolveHash() {
  const replacement = legacyDestinations.get(location.hash);
  if (replacement) {
    history.replaceState(null, '', replacement);
    document.querySelector(replacement)?.scrollIntoView();
  }
  updateActiveLink();
}

menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menu.focus();
  }
});
for (const link of navLinks) {
  link.addEventListener('click', () => {
    if (menu.getAttribute('aria-expanded') !== 'true') return;
    const region = document.querySelector(link.hash);
    if (region) {
      region.tabIndex = -1;
      region.focus({ preventScroll: true });
    }
    setMenu(false);
  });
}
window.addEventListener('hashchange', resolveHash);
resolveHash();

const video = document.querySelector('#hero-logo');
const playback = document.querySelector('#logo-playback');

function reflectPlayback() {
  playback.textContent = video.paused ? 'Play Logo Animation' : 'Pause Logo Animation';
}

function autoplayLogo() {
  video.defaultMuted = true;
  video.muted = true;
  video.play().catch(reflectPlayback);
}

playback.hidden = false;
video.addEventListener('play', reflectPlayback);
video.addEventListener('pause', reflectPlayback);
video.addEventListener('error', reflectPlayback);
playback.addEventListener('click', () => {
  if (video.paused) autoplayLogo();
  else video.pause();
});
if (document.readyState === 'complete') autoplayLogo();
else document.addEventListener('DOMContentLoaded', autoplayLogo, { once: true });
reflectPlayback();

startMediaTabs();
startCompositions();

const aboutPhoto = document.querySelector('[data-about-photo]');
aboutPhoto.addEventListener('click', event => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openAboutPhoto(aboutPhoto).catch(() => location.assign(aboutPhoto.href));
});
function startSlideshow() {
  import('./background.js')
    .then(({startBackground}) => startBackground())
    .catch(() => { /* The opening photo stays in view if the manifest cannot load. */ });
}
if (document.readyState === 'complete') startSlideshow();
else document.addEventListener('DOMContentLoaded', startSlideshow, {once:true});

const form = document.querySelector('#dispatch-form');
const engagement = document.querySelector('#engagement-type');
const disciplines = [...form.querySelectorAll('input[type="checkbox"]')];
const status = document.querySelector('#dispatch-status');
const submit = form.querySelector('[type="submit"]');

function validateDisciplines() {
  const required = Boolean(engagement.value) && engagement.value !== 'General Inquiry';
  const message = required && !disciplines.some((input) => input.checked)
    ? 'Select at least one discipline for this call.' : '';
  disciplines[0].setCustomValidity(message);
}
engagement.addEventListener('change', validateDisciplines);
for (const input of disciplines) input.addEventListener('change', validateDisciplines);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  validateDisciplines();
  if (!form.reportValidity() || submit.disabled) return;

  const payload = new URLSearchParams(new FormData(form));
  submit.disabled = true;
  status.textContent = 'Sending your inquiry…';
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
    });
    if (!response.ok) throw new Error('Submission failed');
    form.reset();
    validateDisciplines();
    status.textContent = 'Inquiry sent. Kevin will follow up to confirm availability.';
  } catch {
    status.textContent = 'Your inquiry could not be sent. Your entries are still here. Try again, or call, text, or email Kevin directly.';
  } finally {
    submit.disabled = false;
  }
});
