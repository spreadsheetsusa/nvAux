import { format } from 'date-fns';

/**
 * @typedef {{ type: 'kanban' | 'music' | 'timeline', aliases: string[], label: string, description: string }} OmniSlashCommand
 */

/** @type {OmniSlashCommand[]} */
export const OMNI_SLASH_COMMANDS = [
  {
    type: 'kanban',
    aliases: ['kanban', 'kb'],
    label: 'Kanban',
    description: 'Create a kanban board',
  },
  {
    type: 'music',
    aliases: ['music', 'drum', 'dm'],
    label: 'Music',
    description: 'Create a drum / music note',
  },
  {
    type: 'timeline',
    aliases: ['timeline', 'gantt', 'tl'],
    label: 'Timeline',
    description: 'Create a multi-lane timeline',
  },
];

/** @type {Map<string, OmniSlashCommand>} */
const ALIAS_MAP = new Map();
for (const cmd of OMNI_SLASH_COMMANDS) {
  for (const alias of cmd.aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), cmd);
  }
}

/**
 * True when Omnibar text is in slash-command mode (leading `/`).
 * @param {string | null | undefined} text
 * @returns {boolean}
 */
export function isOmniSlashInput(text) {
  return typeof text === 'string' && text.startsWith('/');
}

/**
 * Human-readable local date stamp for untitled slash creates.
 * @param {Date} [date]
 * @returns {string}
 */
export function defaultTitleForSlashCommand(date = new Date()) {
  return format(date, 'yyyy-MM-dd HH:mm');
}

/**
 * Filter registered commands by the token after `/` (before first space).
 * Empty prefix returns all commands.
 * @param {string | null | undefined} query
 * @returns {OmniSlashCommand[]}
 */
export function listOmniSlashCommands(query) {
  const raw = (query ?? '').trim();
  const token = raw.startsWith('/') ? raw.slice(1) : raw;
  const prefix = token.split(/\s/)[0]?.toLowerCase() ?? '';
  if (!prefix) return OMNI_SLASH_COMMANDS.slice();
  return OMNI_SLASH_COMMANDS.filter((cmd) => {
    if (cmd.label.toLowerCase().startsWith(prefix)) return true;
    return cmd.aliases.some((a) => a.toLowerCase().startsWith(prefix));
  });
}

/**
 * Build Omnibar text for a command, preserving any title after the first space.
 * Leaves a trailing space when there is no title yet.
 * @param {OmniSlashCommand} command
 * @param {string | null | undefined} currentText
 * @returns {string}
 */
export function autocompleteOmniSlashCommand(command, currentText) {
  const primary = command.aliases[0] || command.type;
  const text = currentText ?? '';
  const rest = text.startsWith('/') ? text.slice(1) : text;
  const spaceIdx = rest.search(/\s/);
  const titlePart = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1);
  const trimmedTitle = titlePart.trim();
  if (trimmedTitle) return `/${primary} ${trimmedTitle}`;
  return `/${primary} `;
}

/**
 * @param {string | null | undefined} text
 * @returns {null | { kind: 'unknown' } | { kind: 'command', type: 'kanban' | 'music' | 'timeline', title: string, alias: string, command: OmniSlashCommand }}
 */
export function parseOmniSlashCommand(text) {
  if (!isOmniSlashInput(text)) return null;
  const rest = text.slice(1);
  if (!rest.trim()) return { kind: 'unknown' };

  const match = rest.match(/^(\S+)(?:\s+(.*))?$/);
  if (!match) return { kind: 'unknown' };

  const alias = match[1].toLowerCase();
  const titleRaw = (match[2] ?? '').trim();
  const command = ALIAS_MAP.get(alias);
  if (!command) return { kind: 'unknown' };

  return {
    kind: 'command',
    type: command.type,
    alias,
    title: titleRaw || defaultTitleForSlashCommand(),
    command,
  };
}
