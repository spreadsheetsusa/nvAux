/**
 * Extract known media URLs from note body text.
 * Extensible: add providers here as more players are supported.
 *
 * @typedef {{ provider: string, url: string, label?: string }} MediaLink
 */

const SOUNDCLOUD_RE =
  /https?:\/\/(?:(?:www|m|on)\.)?(?:soundcloud\.com\/[^\s<>"'`)\]]+|snd\.sc\/[^\s<>"'`)\]]+)/gi;

/**
 * If `url` sits inside a markdown link `[label](url)`, return the label text.
 * @param {string} text
 * @param {number} urlIndex
 * @param {string} url
 * @returns {string | undefined}
 */
function markdownLabelBefore(text, urlIndex, url) {
  // Expect `](url` immediately before the URL (optional title after url is rare; we only match bare).
  if (urlIndex < 2) return undefined;
  if (text[urlIndex - 1] !== '(' || text[urlIndex - 2] !== ']') return undefined;

  // Walk back from `]` to find matching `[` for the link text (no nested brackets).
  const closeBracket = urlIndex - 2;
  let openBracket = -1;
  for (let i = closeBracket - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === ']') return undefined;
    if (ch === '[') {
      openBracket = i;
      break;
    }
    // Labels are usually short; bail if we leave the line or hit a blank line.
    if (ch === '\n') return undefined;
  }
  if (openBracket < 0) return undefined;

  // Confirm closing `)` after the URL (optional trailing punctuation already stripped from url).
  const afterUrl = urlIndex + url.length;
  if (text[afterUrl] !== ')') return undefined;

  const label = text.slice(openBracket + 1, closeBracket).trim();
  return label || undefined;
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

  for (const match of text.matchAll(SOUNDCLOUD_RE)) {
    const raw = match[0];
    const url = raw.replace(/[.,;:!?)]+$/, '');
    if (seen.has(url)) continue;
    seen.add(url);

    const urlIndex = match.index ?? 0;
    // If trailing chars were stripped from the match, the markdown `)` may still follow `url`.
    const label = markdownLabelBefore(text, urlIndex, url);
    /** @type {MediaLink} */
    const link = { provider: 'soundcloud', url };
    if (label) link.label = label;
    links.push(link);
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
