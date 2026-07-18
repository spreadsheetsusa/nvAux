/**
 * MediaWiki-style [[Note Title]] helpers for editor autocomplete and preview.
 */

/**
 * @param {string} text
 * @param {number} cursorIndex
 * @returns {{ start: number, query: string } | null}
 */
export function getOpenWikiQuery(text, cursorIndex) {
  if (typeof text !== 'string' || cursorIndex < 0) return null;
  const before = text.slice(0, cursorIndex);
  const openIdx = before.lastIndexOf('[[');
  if (openIdx === -1) return null;
  const afterOpen = before.slice(openIdx + 2);
  if (afterOpen.includes(']]') || afterOpen.includes('\n')) return null;

  // If a closing ]] already exists after the caret (before newline / next [[),
  // this is a completed link — do not treat it as an open query.
  const afterCursor = text.slice(cursorIndex);
  const closeIdx = afterCursor.indexOf(']]');
  if (closeIdx !== -1) {
    const nextOpen = afterCursor.indexOf('[[');
    const nextNewline = afterCursor.indexOf('\n');
    const blockedByOpen = nextOpen !== -1 && nextOpen < closeIdx;
    const blockedByNewline = nextNewline !== -1 && nextNewline < closeIdx;
    if (!blockedByOpen && !blockedByNewline) return null;
  }

  return { start: openIdx, query: afterOpen };
}

/**
 * @param {string} s
 * @returns {string}
 */
function escapeMarkdownLinkText(s) {
  return s.replace(/([\\\[\]])/g, '\\$1');
}

/** Complete `[[Title]]` tokens (title may not contain `]` or newlines). */
const WIKI_LINK_RE = /\[\[([^\]\n]+)\]\]/g;

/**
 * Extract trimmed titles from complete `[[Title]]` tokens in note body text.
 * @param {string | null | undefined} text
 * @returns {string[]}
 */
export function extractWikiLinkTitles(text) {
  if (!text) return [];
  /** @type {string[]} */
  const titles = [];
  WIKI_LINK_RE.lastIndex = 0;
  let match;
  while ((match = WIKI_LINK_RE.exec(text)) !== null) {
    const name = String(match[1]).trim();
    if (name) titles.push(name);
  }
  return titles;
}

/**
 * Build a note graph from wiki links for visualization.
 * Every note is a node; unresolved `[[Title]]` targets become ghost nodes.
 *
 * @param {Array<{ guid?: string, name?: string, body?: string }>} notes
 * @returns {{
 *   nodes: Array<{ id: string, name: string, guid: string | null, ghost: boolean }>,
 *   links: Array<{ source: string, target: string }>,
 * }}
 */
export function buildNoteGraph(notes) {
  /** @type {Map<string, { id: string, name: string, guid: string | null, ghost: boolean }>} */
  const byName = new Map();

  for (const note of notes || []) {
    const name = (note?.name || '').trim();
    if (!name) continue;
    byName.set(name, {
      id: name,
      name,
      guid: note.guid || null,
      ghost: false,
    });
  }

  /** @type {Array<{ source: string, target: string }>} */
  const links = [];
  /** @type {Set<string>} */
  const seenEdges = new Set();

  for (const note of notes || []) {
    const sourceName = (note?.name || '').trim();
    if (!sourceName || !byName.has(sourceName)) continue;

    for (const rawTarget of extractWikiLinkTitles(note.body)) {
      const targetName = rawTarget.trim();
      if (!targetName || targetName === sourceName) continue;

      if (!byName.has(targetName)) {
        byName.set(targetName, {
          id: targetName,
          name: targetName,
          guid: null,
          ghost: true,
        });
      }

      const edgeKey = `${sourceName}\0${targetName}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);
      links.push({ source: sourceName, target: targetName });
    }
  }

  return { nodes: [...byName.values()], links };
}

/**
 * Turn complete [[Title]] tokens into markdown links marked can render.
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function toWikiPreviewMarkdown(text) {
  if (!text) return '';
  WIKI_LINK_RE.lastIndex = 0;
  return text.replace(WIKI_LINK_RE, (_, title) => {
    const name = String(title).trim();
    if (!name) return `[[${title}]]`;
    const href = `#wiki:${encodeURIComponent(name)}`;
    return `[${escapeMarkdownLinkText(name)}](${href})`;
  });
}

/**
 * @param {string | null | undefined} href
 * @returns {string | null}
 */
export function parseWikiHref(href) {
  if (!href || typeof href !== 'string' || !href.startsWith('#wiki:')) return null;
  try {
    return decodeURIComponent(href.slice(6));
  } catch {
    return null;
  }
}

/**
 * Rank note titles for [[query autocomplete.
 * @param {Array<{ name?: string } | string>} notes
 * @param {string} query
 * @param {number} [limit=8]
 * @returns {string[]}
 */
export function filterWikiSuggestions(notes, query, limit = 8) {
  const q = (query || '').toLowerCase();
  /** @type {string[]} */
  const names = [];
  const seen = new Set();

  for (const note of notes || []) {
    const name = typeof note === 'string' ? note : note?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  const matched = q
    ? names.filter((n) => n.toLowerCase().includes(q))
    : names.slice();

  matched.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aPrefix = q && aLower.startsWith(q) ? 0 : 1;
    const bPrefix = q && bLower.startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return aLower.localeCompare(bLower);
  });

  return matched.slice(0, limit);
}

/**
 * Replace an open [[query with [[Title]].
 * @param {string} text
 * @param {number} start
 * @param {number} cursorIndex
 * @param {string} title
 * @returns {{ text: string, cursor: number }}
 */
export function applyWikiCompletion(text, start, cursorIndex, title) {
  const before = text.slice(0, start);
  let after = text.slice(cursorIndex);
  if (after.startsWith(']]')) after = after.slice(2);
  const insertion = `[[${title}]]`;
  return {
    text: before + insertion + after,
    cursor: before.length + insertion.length,
  };
}

/**
 * Approximate caret coordinates inside a textarea (relative to the element).
 * @param {HTMLTextAreaElement} textarea
 * @param {number} position
 * @returns {{ top: number, left: number, height: number }}
 */
export function getTextareaCaretOffset(textarea, position) {
  const style = window.getComputedStyle(textarea);
  const div = document.createElement('div');
  const span = document.createElement('span');

  const props = [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
    'tabSize',
    'whiteSpace',
    'wordBreak',
    'wordWrap',
  ];

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.top = '0';
  div.style.left = '-9999px';

  for (const prop of props) {
    div.style[prop] = style[prop];
  }

  div.textContent = textarea.value.substring(0, position);
  span.textContent = textarea.value.substring(position) || '.';
  div.appendChild(span);
  document.body.appendChild(div);

  const top = span.offsetTop - textarea.scrollTop;
  const left = span.offsetLeft - textarea.scrollLeft;
  const height = span.offsetHeight;
  document.body.removeChild(div);

  return { top, left, height };
}
