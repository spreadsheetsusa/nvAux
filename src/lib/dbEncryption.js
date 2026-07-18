/**
 * On-device encryption key for RxDB (crypto-js plugin).
 * Key lives in localStorage so the app opens without a passphrase prompt.
 */

export const DB_PASSWORD_KEY = 'dbPassword';

/** RxDB crypto-js plugin requires password length >= 8. */
const PASSWORD_BYTES = 32;

/** @returns {string} */
export function generateDbPassword() {
  const bytes = new Uint8Array(PASSWORD_BYTES);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @returns {string} */
export function getOrCreateDbPassword() {
  const existing = localStorage.getItem(DB_PASSWORD_KEY);
  if (typeof existing === 'string' && existing.length >= 8) {
    return existing;
  }
  const next = generateDbPassword();
  localStorage.setItem(DB_PASSWORD_KEY, next);
  return next;
}

/** Replace the stored password (caller must re-encrypt / recreate the DB). @returns {string} */
export function replaceDbPassword() {
  const next = generateDbPassword();
  localStorage.setItem(DB_PASSWORD_KEY, next);
  return next;
}

/**
 * Short fingerprint for Settings UI (not the raw key).
 * @param {string | null | undefined} [password]
 * @returns {Promise<string>}
 */
export async function getDbPasswordFingerprint(password) {
  const pw =
    typeof password === 'string' && password.length >= 8
      ? password
      : localStorage.getItem(DB_PASSWORD_KEY);
  if (!pw) return '';
  const data = new TextEncoder().encode(pw);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
  return hex.slice(0, 8);
}

/**
 * Whether a legacy RxDB Dexie IndexedDB for `databaseName` exists.
 * @param {string} databaseName
 * @returns {Promise<boolean | null>} true/false when detectable; null if unknown
 */
export async function legacyIndexedDbExists(databaseName) {
  const prefix = `rxdb-dexie-${databaseName}--`;
  if (typeof indexedDB === 'undefined') return false;
  if (typeof indexedDB.databases === 'function') {
    try {
      const dbs = await indexedDB.databases();
      return dbs.some((d) => typeof d.name === 'string' && d.name.startsWith(prefix));
    } catch {
      /* fall through */
    }
  }
  return null;
}
