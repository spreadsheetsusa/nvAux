import * as Tone from 'tone';

/**
 * @typedef {import('./musicModel').MusicProject} MusicProject
 * @typedef {import('./musicModel').MusicTrack} MusicTrack
 * @typedef {import('./musicModel').MusicEffects} MusicEffects
 */

/**
 * Tone.js step-sequencer engine for Music notes.
 * One instance per MusicDaw mount; dispose on unmount.
 */
export function createMusicEngine() {
  /** @type {Map<string, Tone.Player>} */
  const players = new Map();
  /** @type {Map<string, 'loading' | 'ready' | 'error'>} */
  const loadState = new Map();
  /** @type {((trackId: string, state: 'loading' | 'ready' | 'error') => void) | null} */
  let onLoadState = null;
  /** @type {((step: number) => void) | null} */
  let onStep = null;

  /** @type {Tone.Sequence | null} */
  let sequence = null;
  /** @type {MusicProject | null} */
  let project = null;
  let sequenceSteps = 0;
  let disposed = false;

  /** @type {Tone.Filter | null} */
  let filter = null;
  /** @type {Tone.Distortion | null} */
  let distortion = null;
  /** @type {Tone.FeedbackDelay | null} */
  let delay = null;
  /** @type {Tone.Reverb | null} */
  let reverb = null;
  /** @type {Tone.Gain | null} */
  let masterIn = null;
  let fxReady = false;

  function ensureFxChain() {
    if (fxReady || disposed) return;

    masterIn = new Tone.Gain(1);
    filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 12000,
      Q: 1,
    });
    distortion = new Tone.Distortion(0);
    delay = new Tone.FeedbackDelay({
      delayTime: 0.25,
      feedback: 0.25,
      wet: 0,
    });
    reverb = new Tone.Reverb({
      decay: 2.5,
      preDelay: 0.01,
      wet: 0,
    });

    masterIn.chain(filter, distortion, delay, reverb, Tone.getDestination());
    // Generate reverb IR asynchronously; ignore failures
    reverb.generate().catch(() => {});
    fxReady = true;
  }

  /**
   * @param {MusicEffects} effects
   */
  function syncEffects(effects) {
    if (disposed) return;
    ensureFxChain();
    if (!filter || !distortion || !delay || !reverb) return;

    filter.frequency.value = effects.filterFreq;
    filter.Q.value = effects.filterQ;
    distortion.distortion = effects.distortion * 0.85;
    delay.wet.value = effects.delay;
    delay.delayTime.value = effects.delayTime;
    reverb.wet.value = effects.reverb;
  }

  /**
   * @param {string} trackId
   * @param {'loading' | 'ready' | 'error'} state
   */
  function setLoadState(trackId, state) {
    loadState.set(trackId, state);
    onLoadState?.(trackId, state);
  }

  /**
   * @param {MusicTrack} track
   */
  async function ensurePlayer(track) {
    if (disposed) return;
    ensureFxChain();

    const existing = players.get(track.id);
    if (existing) {
      const url = /** @type {string | undefined} */ (
        /** @type {any} */ (existing)._nvauxUrl
      );
      if (url === track.sampleUrl) {
        existing.volume.value = Tone.gainToDb(Math.max(0.0001, track.volume));
        if (existing.loaded) setLoadState(track.id, 'ready');
        return;
      }
      existing.dispose();
      players.delete(track.id);
    }

    setLoadState(track.id, 'loading');
    const player = new Tone.Player();
    if (masterIn) {
      player.connect(masterIn);
    } else {
      player.toDestination();
    }
    /** @type {any} */ (player)._nvauxUrl = track.sampleUrl;
    player.volume.value = Tone.gainToDb(Math.max(0.0001, track.volume));
    players.set(track.id, player);

    try {
      await player.load(track.sampleUrl);
      if (disposed) {
        player.dispose();
        players.delete(track.id);
        return;
      }
      setLoadState(track.id, 'ready');
    } catch {
      if (!disposed) setLoadState(track.id, 'error');
    }
  }

  function ensureSequence() {
    if (!project) return;
    if (sequence && sequenceSteps === project.steps) return;

    const wasPlaying = Tone.getTransport().state === 'started';
    if (sequence) {
      sequence.dispose();
      sequence = null;
    }

    const steps = project.steps;
    sequenceSteps = steps;
    const indices = Array.from({ length: steps }, (_, i) => i);

    sequence = new Tone.Sequence(
      (time, step) => {
        const p = project;
        if (!p) return;
        onStep?.(step);

        const anySolo = p.tracks.some((t) => t.solo);
        for (const track of p.tracks) {
          if (!track.pattern[step]) continue;
          if (track.mute) continue;
          if (anySolo && !track.solo) continue;
          if (loadState.get(track.id) !== 'ready') continue;
          const player = players.get(track.id);
          if (!player || !player.loaded) continue;
          try {
            player.start(time);
          } catch {
            // Ignore overlap / not-ready races
          }
        }
      },
      indices,
      '16n'
    );
    sequence.loop = true;

    if (wasPlaying) {
      sequence.start(0);
    }
  }

  /**
   * @param {MusicProject} next
   */
  async function syncProject(next) {
    if (disposed) return;
    project = next;
    Tone.getTransport().bpm.value = next.bpm;
    Tone.getTransport().swing = next.swing;
    Tone.getTransport().swingSubdivision = '16n';

    syncEffects(next.effects ?? {
      filterFreq: 12000,
      filterQ: 1,
      distortion: 0,
      delay: 0,
      delayTime: 0.25,
      reverb: 0,
    });

    const ids = new Set(next.tracks.map((t) => t.id));
    for (const [id, player] of players) {
      if (!ids.has(id)) {
        player.dispose();
        players.delete(id);
        loadState.delete(id);
      }
    }

    await Promise.all(next.tracks.map((t) => ensurePlayer(t)));
    ensureSequence();
  }

  async function ensureAudio() {
    if (disposed) return;
    await Tone.start();
  }

  async function play() {
    if (disposed || !project) return;
    await ensureAudio();
    ensureSequence();
    const transport = Tone.getTransport();
    if (transport.state === 'started') return;
    sequence?.start(0);
    transport.start();
  }

  function stop() {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    sequence?.stop(0);
    onStep?.(-1);
  }

  function pause() {
    Tone.getTransport().pause();
  }

  /** @returns {boolean} */
  function isPlaying() {
    return Tone.getTransport().state === 'started';
  }

  /**
   * @param {string} trackId
   */
  async function audition(trackId) {
    await ensureAudio();
    const player = players.get(trackId);
    if (!player || !player.loaded) return;
    try {
      player.start();
    } catch {
      // ignore
    }
  }

  /**
   * @param {number} bpm
   */
  function setBpm(bpm) {
    Tone.getTransport().bpm.value = bpm;
    if (project) project = { ...project, bpm };
  }

  /**
   * @param {(trackId: string, state: 'loading' | 'ready' | 'error') => void} cb
   */
  function setOnLoadState(cb) {
    onLoadState = cb;
  }

  /**
   * @param {(step: number) => void} cb
   */
  function setOnStep(cb) {
    onStep = cb;
  }

  /** @returns {Map<string, 'loading' | 'ready' | 'error'>} */
  function getLoadStates() {
    return new Map(loadState);
  }

  function dispose() {
    disposed = true;
    stop();
    if (sequence) {
      sequence.dispose();
      sequence = null;
    }
    for (const player of players.values()) {
      player.dispose();
    }
    players.clear();
    loadState.clear();

    reverb?.dispose();
    delay?.dispose();
    distortion?.dispose();
    filter?.dispose();
    masterIn?.dispose();
    reverb = null;
    delay = null;
    distortion = null;
    filter = null;
    masterIn = null;
    fxReady = false;

    onLoadState = null;
    onStep = null;
    project = null;
    sequenceSteps = 0;
  }

  return {
    syncProject,
    syncEffects,
    play,
    stop,
    pause,
    isPlaying,
    audition,
    setBpm,
    setOnLoadState,
    setOnStep,
    getLoadStates,
    ensureAudio,
    dispose,
  };
}
