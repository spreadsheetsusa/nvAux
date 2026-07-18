/**
 * Tiny frontmatter parser for nvAux note types (no YAML dependency).
 *
 * Expected shape:
 * ---
 * type: kanban
 * sticky: true
 * color: yellow
 * theme:
 *   accent: "#ed0178"
 *   density: comfortable
 * ---
 * <body>
 */

/** @typedef {'yellow' | 'pink' | 'blue'} StickyColor */

export const STICKY_COLORS = /** @type {const} */ (['yellow', 'pink', 'blue']);

/**
 * @typedef {{
 *   type?: string,
 *   sticky?: boolean,
 *   color?: StickyColor,
 *   theme?: { accent?: string, density?: string },
 *   bodyWithoutMeta: string,
 *   hasMeta: boolean
 * }} NoteMeta
 */

/**
 * Unquote a simple scalar value.
 * @param {string} raw
 */
function unquote(raw) {
  const v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * @param {string} value
 * @returns {boolean | undefined}
 */
function parseBool(value) {
  const v = unquote(value).toLowerCase();
  if (v === 'true' || v === 'yes' || v === '1') return true;
  if (v === 'false' || v === 'no' || v === '0') return false;
  return undefined;
}

/**
 * @param {string} value
 * @returns {StickyColor | undefined}
 */
export function normalizeStickyColor(value) {
  const v = unquote(value ?? '').toLowerCase();
  if (STICKY_COLORS.includes(/** @type {StickyColor} */ (v))) {
    return /** @type {StickyColor} */ (v);
  }
  return undefined;
}

/**
 * @param {string | null | undefined} body
 * @returns {NoteMeta}
 */
export function parseNoteMeta(body) {
  const text = body ?? '';
  if (!text.startsWith('---\n') && text !== '---' && !text.startsWith('---\r\n')) {
    return { bodyWithoutMeta: text, hasMeta: false };
  }

  const afterOpen = text.replace(/^---\r?\n/, '');
  const closeMatch = afterOpen.match(/\r?\n---\r?\n/);
  if (!closeMatch || closeMatch.index == null) {
    // Allow closing `---` at end of file with no trailing newline.
    const endClose = afterOpen.match(/\r?\n---\s*$/);
    if (!endClose || endClose.index == null) {
      return { bodyWithoutMeta: text, hasMeta: false };
    }
    const fm = afterOpen.slice(0, endClose.index);
    return { ...parseFrontmatterBlock(fm), bodyWithoutMeta: '', hasMeta: true };
  }

  const fm = afterOpen.slice(0, closeMatch.index);
  const rest = afterOpen.slice(closeMatch.index + closeMatch[0].length);
  return { ...parseFrontmatterBlock(fm), bodyWithoutMeta: rest, hasMeta: true };
}

/**
 * @param {string} fm
 * @returns {{ type?: string, sticky?: boolean, color?: StickyColor, theme?: { accent?: string, density?: string } }}
 */
function parseFrontmatterBlock(fm) {
  /** @type {{ type?: string, sticky?: boolean, color?: StickyColor, theme?: { accent?: string, density?: string } }} */
  const meta = {};
  let inTheme = false;

  for (const line of fm.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const nested = line.match(/^(\s+)([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (inTheme && nested && nested[1].length >= 1) {
      const key = nested[2];
      const value = unquote(nested[3]);
      if (!meta.theme) meta.theme = {};
      if (key === 'accent' || key === 'density') {
        meta.theme[key] = value;
      }
      continue;
    }

    const top = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!top) {
      inTheme = false;
      continue;
    }

    const key = top[1];
    const value = top[2].trim();

    if (key === 'theme' && value === '') {
      inTheme = true;
      if (!meta.theme) meta.theme = {};
      continue;
    }

    inTheme = false;
    if (key === 'type') {
      meta.type = unquote(value);
    } else if (key === 'sticky') {
      const b = parseBool(value);
      if (b !== undefined) meta.sticky = b;
    } else if (key === 'color') {
      const c = normalizeStickyColor(value);
      if (c) meta.color = c;
    } else if (key === 'theme' && value) {
      // Inline theme ignored — keep nested form only.
    }
  }

  return meta;
}

/**
 * Serialize frontmatter + body content.
 * Omits `type` when absent so plain markdown stickies stay markdown.
 * @param {{
 *   type?: string,
 *   sticky?: boolean,
 *   color?: StickyColor,
 *   theme?: { accent?: string, density?: string },
 * }} meta
 * @param {string} bodyContent
 * @returns {string}
 */
export function serializeNoteMeta(meta, bodyContent) {
  const lines = ['---'];
  if (meta.type) lines.push(`type: ${meta.type}`);
  if (meta.sticky === true) lines.push('sticky: true');
  if (meta.sticky === true && meta.color) {
    lines.push(`color: ${meta.color}`);
  }
  const theme = meta.theme;
  if (theme && (theme.accent || theme.density)) {
    lines.push('theme:');
    if (theme.accent) lines.push(`  accent: "${theme.accent}"`);
    if (theme.density) lines.push(`  density: ${theme.density}`);
  }
  lines.push('---');
  const body = bodyContent ?? '';
  return body ? `${lines.join('\n')}\n${body}` : `${lines.join('\n')}\n`;
}

/**
 * Merge sticky fields into an existing note body (preserves type/theme/content).
 * When sticky is false, sticky/color keys are removed; if no other meta remains,
 * frontmatter is dropped entirely.
 * @param {string | null | undefined} body
 * @param {{ sticky: boolean, color?: StickyColor }} patch
 * @returns {string}
 */
export function applyStickyMeta(body, patch) {
  const parsed = parseNoteMeta(body ?? '');
  const content = parsed.bodyWithoutMeta;

  /** @type {{ type?: string, sticky?: boolean, color?: StickyColor, theme?: { accent?: string, density?: string } }} */
  const meta = {};
  if (parsed.type) meta.type = parsed.type;
  if (parsed.theme && (parsed.theme.accent || parsed.theme.density)) {
    meta.theme = { ...parsed.theme };
  }

  if (patch.sticky) {
    meta.sticky = true;
    meta.color = normalizeStickyColor(patch.color ?? parsed.color ?? 'yellow') ?? 'yellow';
  }

  const hasMeta =
    !!meta.type ||
    meta.sticky === true ||
    !!(meta.theme && (meta.theme.accent || meta.theme.density));

  if (!hasMeta) return content;
  return serializeNoteMeta(meta, content);
}

/**
 * @param {string | null | undefined} body
 * @returns {boolean}
 */
export function isNoteSticky(body) {
  return parseNoteMeta(body ?? '').sticky === true;
}

/**
 * @param {string | null | undefined} body
 * @returns {StickyColor}
 */
export function getStickyColor(body) {
  return normalizeStickyColor(parseNoteMeta(body ?? '').color ?? '') ?? 'yellow';
}
