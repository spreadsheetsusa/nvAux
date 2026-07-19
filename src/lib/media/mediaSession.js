import { get, writable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';

import {
  extractMediaLinks,
  hasQueueableMedia,
  mediaProviderFromUrl,
} from '../../utils/extractMediaLinks';

/**
 * @typedef {{
 *   id: string,
 *   url: string,
 *   noteGuid: string,
 *   noteName: string,
 *   provider: 'soundcloud' | 'youtube' | 'image' | 'video',
 *   label?: string,
 *   played: boolean
 * }} MediaTrack
 */

/** @type {import('svelte/store').Writable<MediaTrack[]>} */
export const mediaPlaylist = writable([]);

/** Index of the current track in mediaPlaylist. */
export const mediaTrackIndex = writable(0);

/**
 * Incremented when Play Now (or similar) should start playback after load.
 * AudioPlayer watches this token.
 */
export const mediaPlayRequest = writable(0);

export { hasQueueableMedia };

/**
 * Infer provider for tracks that may predate the provider field.
 * @param {Pick<MediaTrack, 'url' | 'provider'> | null | undefined} track
 * @returns {'soundcloud' | 'youtube' | 'image' | 'video'}
 */
export function mediaTrackProvider(track) {
  if (track?.provider) return track.provider;
  return mediaProviderFromUrl(track?.url);
}

/**
 * Build session tracks from a note + body (deduped by URL within this batch).
 * @param {{ guid?: string, name?: string } | null | undefined} note
 * @param {string | null | undefined} body
 * @returns {MediaTrack[]}
 */
export function buildTracksFromNote(note, body) {
  const links = extractMediaLinks(body);
  const noteGuid = note?.guid ?? '';
  const noteName = note?.name ?? 'Untitled';
  return links.map((link) => {
    /** @type {MediaTrack} */
    const track = {
      id: uuidv4(),
      url: link.url,
      noteGuid,
      noteName,
      provider: link.provider,
      played: false,
    };
    if (link.label) track.label = link.label;
    return track;
  });
}

/**
 * @param {MediaTrack[]} list
 * @param {number} index
 */
function syncPlayedFlags(list, index) {
  return list.map((t, i) => ({
    ...t,
    played: i < index,
  }));
}

/**
 * @param {MediaTrack[]} tracks
 */
export function mediaAddNext(tracks) {
  if (!tracks?.length) return;
  const list = get(mediaPlaylist);
  const index = get(mediaTrackIndex);

  if (!list.length) {
    mediaPlaylist.set(tracks.map((t) => ({ ...t, played: false })));
    mediaTrackIndex.set(0);
    return;
  }

  const insertAt = Math.min(index + 1, list.length);
  const next = [
    ...list.slice(0, insertAt),
    ...tracks.map((t) => ({ ...t, played: false })),
    ...list.slice(insertAt),
  ];
  mediaPlaylist.set(syncPlayedFlags(next, index));
}

/**
 * @param {MediaTrack[]} tracks
 */
export function mediaAddLast(tracks) {
  if (!tracks?.length) return;
  const list = get(mediaPlaylist);
  const index = get(mediaTrackIndex);

  if (!list.length) {
    mediaPlaylist.set(tracks.map((t) => ({ ...t, played: false })));
    mediaTrackIndex.set(0);
    return;
  }

  const next = [...list, ...tracks.map((t) => ({ ...t, played: false }))];
  mediaPlaylist.set(syncPlayedFlags(next, index));
}

/**
 * Insert at current position, jump to first inserted track, request play.
 * @param {MediaTrack[]} tracks
 */
export function mediaPlayNow(tracks) {
  if (!tracks?.length) return;
  const list = get(mediaPlaylist);
  const index = get(mediaTrackIndex);

  if (!list.length) {
    mediaPlaylist.set(tracks.map((t) => ({ ...t, played: false })));
    mediaTrackIndex.set(0);
    mediaPlayRequest.update((n) => n + 1);
    return;
  }

  const next = [
    ...list.slice(0, index),
    ...tracks.map((t) => ({ ...t, played: false })),
    ...list.slice(index),
  ];
  mediaPlaylist.set(syncPlayedFlags(next, index));
  mediaTrackIndex.set(index);
  mediaPlayRequest.update((n) => n + 1);
}

export function mediaClearSession() {
  mediaPlaylist.set([]);
  mediaTrackIndex.set(0);
}

/**
 * @param {string} trackId
 */
export function mediaRemoveTrack(trackId) {
  const list = get(mediaPlaylist);
  const index = get(mediaTrackIndex);
  const removeAt = list.findIndex((t) => t.id === trackId);
  if (removeAt < 0) return;

  const next = list.filter((t) => t.id !== trackId);
  if (!next.length) {
    mediaClearSession();
    return;
  }

  let nextIndex = index;
  if (removeAt < index) nextIndex = index - 1;
  else if (removeAt === index) nextIndex = Math.min(index, next.length - 1);

  mediaTrackIndex.set(nextIndex);
  mediaPlaylist.set(syncPlayedFlags(next, nextIndex));
}

/**
 * Move track from fromIndex to toIndex (destination index in pre-remove list semantics:
 * splice out then insert at toIndex adjusted).
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export function mediaReorderTrack(fromIndex, toIndex) {
  const list = get(mediaPlaylist);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return;
  }

  const currentId = list[get(mediaTrackIndex)]?.id;
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);

  let nextIndex = next.findIndex((t) => t.id === currentId);
  if (nextIndex < 0) nextIndex = 0;

  mediaTrackIndex.set(nextIndex);
  mediaPlaylist.set(syncPlayedFlags(next, nextIndex));
}

/** Mark current track played and advance (on FINISH). */
export function mediaAdvanceAfterFinish() {
  const list = get(mediaPlaylist);
  const index = get(mediaTrackIndex);
  if (index >= list.length - 1) {
    const done = list.map((t, i) => (i === index ? { ...t, played: true } : t));
    mediaPlaylist.set(done);
    return false;
  }
  const nextIndex = index + 1;
  mediaTrackIndex.set(nextIndex);
  mediaPlaylist.set(syncPlayedFlags(list, nextIndex));
  return true;
}

/**
 * Jump to a track by index (e.g. playlist row click).
 * @param {number} index
 * @param {boolean} [requestPlay]
 */
export function mediaJumpTo(index, requestPlay = false) {
  const list = get(mediaPlaylist);
  if (index < 0 || index >= list.length) return;
  mediaTrackIndex.set(index);
  mediaPlaylist.set(syncPlayedFlags(list, index));
  if (requestPlay) mediaPlayRequest.update((n) => n + 1);
}
