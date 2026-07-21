<script>
  // @ts-nocheck
  import { onDestroy } from 'svelte';
  import {
    parseMusicNote,
    serializeMusicNote,
    toggleStep,
    updateTrack,
    setSteps,
    selectPattern,
    updateEffects,
    MIN_BPM,
    MAX_BPM,
  } from './musicModel';
  import { createMusicEngine } from './musicEngine';
  import MusicTransport from './MusicTransport.svelte';
  import MusicTrackRow from './MusicTrackRow.svelte';
  import MusicSamplePicker from './MusicSamplePicker.svelte';
  import MusicPatternBank from './MusicPatternBank.svelte';
  import MusicEffects from './MusicEffects.svelte';

  let {
    body = '',
    onChange,
  } = $props();

  let project = $state.raw(null);
  let theme = $state.raw({ skin: 'winamp' });
  let parseError = $state(null);
  let lastBody = $state('');

  let playing = $state(false);
  let currentStep = $state(-1);
  /** @type {Record<string, 'loading' | 'ready' | 'error'>} */
  let loadStates = $state({});

  let pickerOpen = $state(false);
  let pickerTrackId = $state(null);
  /** @type {HTMLElement | undefined} */
  let pickerAnchor = $state();

  const engine = createMusicEngine();

  engine.setOnStep((step) => {
    currentStep = step;
  });

  engine.setOnLoadState((trackId, state) => {
    loadStates = { ...loadStates, [trackId]: state };
  });

  /** @type {ReturnType<typeof setTimeout> | null} */
  let persistTimer = null;
  /** @type {{ theme: any, project: any } | null} */
  let persistPending = null;

  function flushPersist() {
    if (persistTimer != null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const pending = persistPending;
    persistPending = null;
    if (!pending) return;
    const serialized = serializeMusicNote(pending.theme, pending.project);
    lastBody = serialized;
    onChange?.(serialized);
  }

  /** Debounced serialize → parent bodyText so clicks stay snappy. */
  function schedulePersist(nextTheme, nextProject) {
    persistPending = { theme: nextTheme, project: nextProject };
    if (persistTimer != null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      flushPersist();
    }, 300);
  }

  /** Immediate serialize (sample / steps / unmount). */
  function emitImmediate(nextTheme, nextProject) {
    if (persistTimer != null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    persistPending = null;
    const serialized = serializeMusicNote(nextTheme, nextProject);
    lastBody = serialized;
    project = nextProject;
    theme = nextTheme;
    parseError = null;
    onChange?.(serialized);
  }

  onDestroy(() => {
    flushPersist();
    engine.dispose();
  });

  // Sync from note body when external edits land (Edit mode / other windows).
  // Also runs the one-time heavy engine sync for the loaded project.
  $effect(() => {
    const nextBody = body ?? '';
    if (nextBody === lastBody && project) return;
    lastBody = nextBody;
    const result = parseMusicNote(nextBody);
    project = result.project;
    theme = result.theme;
    parseError = result.parseError;

    if (!result.project || result.parseError) return;

    let cancelled = false;
    (async () => {
      await engine.syncProject(result.project);
      if (cancelled) return;
      const states = {};
      for (const [id, state] of engine.getLoadStates()) {
        states[id] = state;
      }
      loadStates = states;
    })();
    return () => {
      cancelled = true;
    };
  });

  let statusText = $derived.by(() => {
    if (parseError) return 'PARSE ERR';
    if (!project) return '…';
    const states = Object.values(loadStates);
    if (states.some((s) => s === 'error')) return 'CORS / LOAD ERR';
    if (states.some((s) => s === 'loading') || states.length < project.tracks.length) {
      return 'LOADING';
    }
    const pat = (project.activePattern ?? 0) + 1;
    return playing ? `PLAY P${pat}` : `P${pat}`;
  });

  let hasLoadError = $derived(
    Object.values(loadStates).some((s) => s === 'error')
  );

  /** CSS playhead vars — update without invalidating pad buttons. */
  let playheadStep = $derived(playing && currentStep >= 0 ? currentStep : -1);
  let playheadOn = $derived(playheadStep >= 0 ? 1 : 0);

  /**
   * Optimistic UI + cheap audio ref update + debounced persist.
   * @param {(p: any) => any} mutator
   * @param {'ref' | 'bpm' | 'none'} [audio]
   */
  function updateProject(mutator, audio = 'ref') {
    if (!project) return;
    const next = mutator(project);
    if (!next || next === project) return;
    project = next;
    parseError = null;

    if (audio === 'ref') {
      engine.setProject(next);
    } else if (audio === 'bpm') {
      engine.setBpm(next.bpm);
      engine.setProject(next);
    }

    schedulePersist(theme, next);
  }

  async function handlePlay() {
    if (!project) return;
    await engine.play();
    playing = engine.isPlaying();
  }

  function handleStop() {
    engine.stop();
    playing = false;
    currentStep = -1;
  }

  function handleBpm(nextBpm) {
    const bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, nextBpm));
    updateProject((p) => ({ ...p, bpm }), 'bpm');
  }

  async function handleSteps(nextSteps) {
    if (!project) return;
    const next = setSteps(project, nextSteps);
    if (!next || next === project) return;
    project = next;
    await engine.syncProject(next);
    const states = {};
    for (const [id, state] of engine.getLoadStates()) {
      states[id] = state;
    }
    loadStates = states;
    emitImmediate(theme, next);
  }

  function handleToggleStep(trackId, stepIndex) {
    updateProject((p) => toggleStep(p, trackId, stepIndex));
  }

  function handleToggleMute(trackId) {
    updateProject((p) => {
      const t = p.tracks.find((x) => x.id === trackId);
      if (!t) return p;
      return updateTrack(p, trackId, { mute: !t.mute });
    });
  }

  function handleToggleSolo(trackId) {
    updateProject((p) => {
      const t = p.tracks.find((x) => x.id === trackId);
      if (!t) return p;
      return updateTrack(p, trackId, { solo: !t.solo });
    });
  }

  function handleVolume(trackId, volume) {
    if (!project) return;
    engine.setTrackVolume(trackId, volume);
    updateProject((p) => updateTrack(p, trackId, { volume }));
  }

  function handleSelectPattern(index) {
    updateProject((p) => selectPattern(p, index));
  }

  function handleEffects(patch) {
    if (!project) return;
    const next = updateEffects(project, patch);
    engine.syncEffects(next.effects);
    project = next;
    engine.setProject(next);
    schedulePersist(theme, next);
  }

  function openPicker(trackId, anchorEl) {
    pickerTrackId = trackId;
    pickerAnchor = anchorEl;
    pickerOpen = true;
  }

  function closePicker() {
    pickerOpen = false;
    pickerTrackId = null;
  }

  async function selectSample(sample) {
    if (!pickerTrackId || !project) return;
    const next = updateTrack(project, pickerTrackId, { sampleUrl: sample.url });
    project = next;
    await engine.syncProject(next);
    const states = {};
    for (const [id, state] of engine.getLoadStates()) {
      states[id] = state;
    }
    loadStates = states;
    emitImmediate(theme, next);
    closePicker();
  }

  let pickerTrack = $derived(
    project && pickerTrackId
      ? project.tracks.find((t) => t.id === pickerTrackId)
      : null
  );
</script>

<div class="music-daw flex flex-col flex-1 min-h-0 w-full mt-3">
  {#if parseError}
    <div class="music-banner music-banner-err shrink-0 px-3 py-2 text-sm">
      Invalid music JSON — switch to Edit to fix. ({parseError})
    </div>
  {/if}
  {#if hasLoadError}
    <div class="music-banner music-banner-warn shrink-0 px-3 py-2 text-sm">
      Some samples failed to load. Ensure the sample host sends CORS headers
      (<code>Access-Control-Allow-Origin</code>) for this origin.
    </div>
  {/if}

  {#if project}
    <div class="music-shell flex flex-col flex-1 min-h-0 overflow-hidden">
      <MusicTransport
        playing={playing}
        bpm={project.bpm}
        currentStep={currentStep}
        steps={project.steps}
        statusText={statusText}
        onPlay={handlePlay}
        onStop={handleStop}
        onBpmChange={handleBpm}
        onStepsChange={handleSteps}
      />

      <div class="music-body flex flex-row flex-1 min-h-0 overflow-hidden">
        <MusicPatternBank
          patternBank={project.patternBank}
          activePattern={project.activePattern}
          onSelect={handleSelectPattern}
        />
        <div
          class="music-tracks thin-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-auto"
          style:--music-ph={playheadStep}
          style:--music-ph-on={playheadOn}
        >
          {#each project.tracks as track (track.id)}
            <MusicTrackRow
              {track}
              steps={project.steps}
              loadState={loadStates[track.id] ?? 'loading'}
              onToggleStep={(i) => handleToggleStep(track.id, i)}
              onToggleMute={() => handleToggleMute(track.id)}
              onToggleSolo={() => handleToggleSolo(track.id)}
              onVolumeChange={(v) => handleVolume(track.id, v)}
              onOpenSamplePicker={(el) => openPicker(track.id, el)}
              onAudition={() => engine.audition(track.id)}
            />
          {/each}
        </div>
      </div>

      <MusicEffects effects={project.effects} onChange={handleEffects} />
    </div>
  {/if}
</div>

<MusicSamplePicker
  open={pickerOpen}
  anchorEl={pickerAnchor}
  currentUrl={pickerTrack?.sampleUrl ?? ''}
  onSelect={selectSample}
  onClose={closePicker}
/>

<style>
  .music-daw {
    min-height: 0;
  }

  .music-shell {
    background: #1a1a1c;
    border: 1px solid #0a0a0a;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 2px 8px rgba(0, 0, 0, 0.35);
  }

  .music-body {
    min-height: 0;
  }

  .music-banner {
    font-size: 12px;
    margin-bottom: 6px;
    border-radius: 2px;
  }

  .music-banner-err {
    background: rgba(120, 30, 30, 0.35);
    color: #ffc0c0;
    border: 1px solid rgba(180, 60, 60, 0.5);
  }

  .music-banner-warn {
    background: rgba(100, 80, 20, 0.35);
    color: #ffe8a0;
    border: 1px solid rgba(160, 120, 40, 0.5);
  }

  .music-banner code {
    font-size: 11px;
  }
</style>
