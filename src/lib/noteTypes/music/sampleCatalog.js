/** Base URL for the 99-drum-samples kit on S3. */
export const SAMPLE_BASE_URL =
  'https://bpk-endless.s3.amazonaws.com/99-drum-samples';

/** @typedef {{ id: string, name: string, url: string, category: string }} DrumSample */

/** @type {readonly string[]} */
const SAMPLE_FILES = [
  'clap-808.wav',
  'clap-analog.wav',
  'clap-crushed.wav',
  'clap-fat.wav',
  'clap-slapper.wav',
  'clap-tape.wav',
  'cowbell-808.wav',
  'crash-808.wav',
  'crash-acoustic.wav',
  'crash-noise.wav',
  'crash-tape.wav',
  'hihat-808.wav',
  'hihat-acoustic01.wav',
  'hihat-acoustic02.wav',
  'hihat-analog.wav',
  'hihat-digital.wav',
  'hihat-dist01.wav',
  'hihat-dist02.wav',
  'hihat-electro.wav',
  'hihat-plain.wav',
  'hihat-reso.wav',
  'hihat-ring.wav',
  'kick-808.wav',
  'kick-acoustic01.wav',
  'kick-acoustic02.wav',
  'kick-big.wav',
  'kick-classic.wav',
  'kick-cultivator.wav',
  'kick-deep.wav',
  'kick-dry.wav',
  'kick-electro01.wav',
  'kick-electro02.wav',
  'kick-floppy.wav',
  'kick-gritty.wav',
  'kick-heavy.wav',
  'kick-newwave.wav',
  'kick-oldschool.wav',
  'kick-plain.wav',
  'kick-slapback.wav',
  'kick-softy.wav',
  'kick-stomp.wav',
  'kick-tape.wav',
  'kick-thump.wav',
  'kick-tight.wav',
  'kick-tron.wav',
  'kick-vinyl01.wav',
  'kick-vinyl02.wav',
  'kick-zapper.wav',
  'openhat-808.wav',
  'openhat-acoustic01.wav',
  'openhat-analog.wav',
  'openhat-slick.wav',
  'openhat-tight.wav',
  'perc-808.wav',
  'perc-chirpy.wav',
  'perc-hollow.wav',
  'perc-laser.wav',
  'perc-metal.wav',
  'perc-nasty.wav',
  'perc-short.wav',
  'perc-tambo.wav',
  'perc-tribal.wav',
  'perc-weirdo.wav',
  'ride-acoustic01.wav',
  'ride-acoustic02.wav',
  'shaker-analog.wav',
  'shaker-shuffle.wav',
  'shaker-suckup.wav',
  'snare-808.wav',
  'snare-acoustic01.wav',
  'snare-acoustic02.wav',
  'snare-analog.wav',
  'snare-big.wav',
  'snare-block.wav',
  'snare-brute.wav',
  'snare-dist01.wav',
  'snare-dist02.wav',
  'snare-dist03.wav',
  'snare-electro.wav',
  'snare-lofi01.wav',
  'snare-lofi02.wav',
  'snare-modular.wav',
  'snare-noise.wav',
  'snare-pinch.wav',
  'snare-punch.wav',
  'snare-smasher.wav',
  'snare-sumo.wav',
  'snare-tape.wav',
  'snare-vinyl01.wav',
  'snare-vinyl02.wav',
  'tom-808.wav',
  'tom-acoustic01.wav',
  'tom-acoustic02.wav',
  'tom-analog.wav',
  'tom-chiptune.wav',
  'tom-fm.wav',
  'tom-lofi.wav',
  'tom-rototom.wav',
  'tom-short.wav',
];

/**
 * @param {string} filename
 * @returns {string}
 */
export function sampleUrl(filename) {
  return `${SAMPLE_BASE_URL}/${filename}`;
}

/**
 * @param {string} filename
 * @returns {string}
 */
function categoryFromFilename(filename) {
  const base = filename.replace(/\.wav$/i, '');
  const dash = base.indexOf('-');
  return dash > 0 ? base.slice(0, dash) : base;
}

/**
 * @param {string} filename
 * @returns {string}
 */
function labelFromFilename(filename) {
  return filename
    .replace(/\.wav$/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** @type {readonly DrumSample[]} */
export const SAMPLE_CATALOG = SAMPLE_FILES.map((file) => ({
  id: file.replace(/\.wav$/i, ''),
  name: labelFromFilename(file),
  url: sampleUrl(file),
  category: categoryFromFilename(file),
}));

/** Unique categories in catalog order. */
export const SAMPLE_CATEGORIES = [
  ...new Set(SAMPLE_CATALOG.map((s) => s.category)),
];

/**
 * Default 8-track kit (filename → track name).
 * @type {readonly { name: string, file: string }[]}
 */
export const DEFAULT_KIT = [
  { name: 'Kick', file: 'kick-808.wav' },
  { name: 'Snare', file: 'snare-808.wav' },
  { name: 'Closed Hat', file: 'hihat-808.wav' },
  { name: 'Open Hat', file: 'openhat-808.wav' },
  { name: 'Clap', file: 'clap-808.wav' },
  { name: 'Perc', file: 'perc-808.wav' },
  { name: 'Tom', file: 'tom-808.wav' },
  { name: 'Crash', file: 'crash-808.wav' },
];

/**
 * @param {string} query
 * @param {string} [category]
 * @returns {DrumSample[]}
 */
export function filterSamples(query, category) {
  const q = (query ?? '').trim().toLowerCase();
  return SAMPLE_CATALOG.filter((s) => {
    if (category && s.category !== category) return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  });
}
