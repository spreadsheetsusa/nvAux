/**
 * Extract known media URLs from note body text.
 * Extensible: add providers here as more players are supported.
 *
 * @typedef {{ provider: string, url: string }} MediaLink
 */

const SOUNDCLOUD_RE =
  /https?:\/\/(?:(?:www|m|on)\.)?(?:soundcloud\.com\/[^\s<>"'`)\]]+|snd\.sc\/[^\s<>"'`)\]]+)/gi;

/**
 * @param {string | null | undefined} text
 * @returns {MediaLink[]}
 */
export function extractMediaLinks(text) {
  if (!text) return [];

  /** @type {MediaLink[]} */
  const links = [];
  const seen = new Set();

  for (const match of text.matchAll(SOUNDCLOUD_RE)) {
    const url = match[0].replace(/[.,;:!?)]+$/, '');
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ provider: 'soundcloud', url });
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
