const tabs = [...document.querySelectorAll('.portfolio-tabs [role="tab"]')];
const pending = new Map();
let videoModule;

async function load(tab) {
  if (pending.has(tab)) return;
  const panel = document.getElementById(tab.getAttribute('aria-controls'));
  pending.set(tab, true);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = 'Loading portfolio media…';
  panel.replaceChildren(status);
  panel.setAttribute('aria-busy', 'true');
  try {
    if (tab.id === 'pictures-tab') {
      const { mountPictures } = await import('./portfolio.js');
      await mountPictures(panel);
    } else {
      videoModule = await import('./videos.js');
      await videoModule.mountVideos(panel);
    }
  } catch {
    pending.delete(tab);
    status.textContent = 'Portfolio media could not load.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button secondary';
    retry.textContent = 'Try Again';
    retry.addEventListener('click', () => {
      panel.focus();
      void load(tab);
    });
    panel.append(retry);
  } finally {
    panel.removeAttribute('aria-busy');
  }
}

function activate(tab) {
  for (const item of tabs) {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    const panel = document.getElementById(item.getAttribute('aria-controls'));
    panel.hidden = !active;
    if (!active && item.id === 'videos-tab') videoModule?.stopVideos(panel);
    if (!active && item.id === 'pictures-tab') panel.dispatchEvent(new Event('portfolio-hidden'));
  }
  void load(tab);
}

export function startMediaTabs() {
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      const steps = { ArrowLeft: -1, ArrowRight: 1, Home: -index, End: tabs.length - 1 - index };
      if (!Object.hasOwn(steps,event.key)) return;
      event.preventDefault();
      const next = tabs[(index + steps[event.key] + tabs.length) % tabs.length];
      next.focus();
      activate(next);
    });
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void load(tabs.find(tab => tab.getAttribute('aria-selected') === 'true'));
    }, { rootMargin: '275px' });
    observer.observe(document.querySelector('#portfolio-browser'));
  } else {
    void load(tabs[0]);
  }
}
