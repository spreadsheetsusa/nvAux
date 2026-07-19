// SoundCloud Widget API loader + shared widget options.
// Pure helpers with no Svelte component state — play/seek/volume orchestration
// and event binding (which needs component state) stay in AudioPlayer.svelte.

export const WIDGET_API_SRC = 'https://w.soundcloud.com/player/api.js';

export const WIDGET_OPTS = {
  show_artwork: false,
  show_comments: false,
  sharing: false,
  download: false,
  buying: false,
  auto_play: false,
  visual: false,
  single_active: true,
};

/** @type {Promise<void> | null} */
let widgetApiPromise = null;

/** @returns {Promise<void>} */
export function loadWidgetApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.SC?.Widget) return Promise.resolve();
  if (widgetApiPromise) return widgetApiPromise;

  widgetApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${WIDGET_API_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Widget API failed')));
      if (window.SC?.Widget) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = WIDGET_API_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Widget API failed'));
    document.head.appendChild(script);
  });

  return widgetApiPromise;
}
