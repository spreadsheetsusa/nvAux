/**
 * Extract known media URLs from note body text.
 * Extensible: add providers here as more players are supported.
 *
 * @typedef {{ provider: 'soundcloud' | 'image' | 'video', url: string, label?: string }} MediaLink
 */

const SOUNDCLOUD_RE =
  /https?:\/\/(?:(?:www|m|on)\.)?(?:soundcloud\.com\/[^\s<>"'`)\]]+|snd\.sc\/[^\s<>"'`)\]]+)/gi;

const MD_IMAGE_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
const MD_LINK_RE = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;
const BARE_URL_RE =
  /https?:\/\/[^\s<>"'`)\]]+/gi;

const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?|$)/i;
const VIDEO_EXT_RE = /\.(?:mp4|webm|ogg|mov)(?:\?|$)/i;

/**
 * @param {string} url
 * @returns {'image' | 'video' | null}
 */
function fileProviderForUrl(url) {
  const path = url.split('#')[0];
  if (IMAGE_EXT_RE.test(path)) return 'image';
  if (VIDEO_EXT_RE.test(path)) return 'video';
  return null;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function cleanUrl(raw) {
  return raw.replace(/[.,;:!?)]+$/, '');
}

/**
 * If `url` sits inside a markdown link `[label](url)`, return the label text.
 * @param {string} text
 * @param {number} urlIndex
 * @param {string} url
 * @returns {string | undefined}
 */
function markdownLabelBefore(text, urlIndex, url) {
  if (urlIndex < 2) return undefined;
  if (text[urlIndex - 1] !== '(' || text[urlIndex - 2] !== ']') return undefined;

  const closeBracket = urlIndex - 2;
  let openBracket = -1;
  for (let i = closeBracket - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === ']') return undefined;
    if (ch === '[') {
      openBracket = i;
      break;
    }
    if (ch === '\n') return undefined;
  }
  if (openBracket < 0) return undefined;

  // Image syntax ![alt](url) — treat alt as label.
  const isImage = openBracket > 0 && text[openBracket - 1] === '!';

  const afterUrl = urlIndex + url.length;
  if (text[afterUrl] !== ')') return undefined;

  const label = text.slice(openBracket + 1, closeBracket).trim();
  return label || (isImage ? undefined : undefined);
}

/**
 * @param {string | null | undefined} text
 * @returns {MediaLink[]}
 */
export function extractMediaLinks(text) {
  if (!text) return [];

  /** @type {MediaLink[]} */
  const links = [];
  const seen = new Set();

  /**
   * @param {string} provider
   * @param {string} url
   * @param {string | undefined} [label]
   */
  function push(provider, url, label) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    /** @type {MediaLink} */
    const link = { provider: /** @type {MediaLink['provider']} */ (provider), url };
    if (label) link.label = label;
    links.push(link);
  }

  for (const match of text.matchAll(SOUNDCLOUD_RE)) {
    const url = cleanUrl(match[0]);
    const urlIndex = match.index ?? 0;
    const label = markdownLabelBefore(text, urlIndex, url);
    push('soundcloud', url, label);
  }

  for (const match of text.matchAll(MD_IMAGE_RE)) {
    const label = (match[1] || '').trim() || undefined;
    const url = cleanUrl(match[2]);
    const provider = fileProviderForUrl(url);
    if (provider) push(provider, url, label);
  }

  for (const match of text.matchAll(MD_LINK_RE)) {
    const label = (match[1] || '').trim() || undefined;
    const url = cleanUrl(match[2]);
    if (/soundcloud\.com|snd\.sc/i.test(url)) continue;
    const provider = fileProviderForUrl(url);
    if (provider) push(provider, url, label);
  }

  for (const match of text.matchAll(BARE_URL_RE)) {
    const url = cleanUrl(match[0]);
    if (seen.has(url)) continue;
    if (/soundcloud\.com|snd\.sc/i.test(url)) continue;
    const provider = fileProviderForUrl(url);
    if (provider) push(provider, url);
  }

  return links;
}

/**
 * @param {string | null | undefined} text
 * @returns {MediaLink | null}
 */
export function firstMediaLink(text) {
  return extractMediaLinks(text)[0] ?? null;
}

/**
 * Cheap presence check for toolbar (avoids full extraction on each keystroke).
 * @param {string | null | undefined} text
 * @returns {boolean}
 */
export function hasQueueableMedia(text) {
  const t = text || '';
  if (/soundcloud\.com|snd\.sc/i.test(t)) return true;
  return /https?:\/\/[^\s<>"'`)\]]+\.(?:png|jpe?g|gif|webp|avif|svg|mp4|webm|ogg|mov)(?:\?|[^\w]|$)/i.test(
    t
  );
}
