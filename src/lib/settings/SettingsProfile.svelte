<script>
  import { differenceInYears } from 'date-fns';
  import { birthDate, expectedLongevity } from '$lib/store';
  import './settingsForms.css';

  const LONGEVITY_MAX = 120;

  /** @param {string} iso YYYY-MM-DD in local time (avoids UTC parse shift) */
  function parseLocalDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** Min expected longevity: current age + 1 (must include the current year of life). */
  let longevityMin = $derived.by(() => {
    const iso = $birthDate;
    if (!iso) return 1;
    const birth = parseLocalDate(iso);
    if (Number.isNaN(birth.getTime())) return 1;
    const age = differenceInYears(new Date(), birth);
    if (!Number.isFinite(age) || age < 0) return 1;
    return Math.min(LONGEVITY_MAX, age + 1);
  });

  // Keep stored longevity from falling below the birthdate-derived minimum.
  $effect(() => {
    const min = longevityMin;
    const current = parseInt($expectedLongevity, 10);
    if (!Number.isFinite(current) || current < min) {
      $expectedLongevity = String(min);
    }
  });
</script>

<div style="border: 1px solid #2b2d30; border-radius: 8px; margin-top: 20px; padding: 15px;">
  <div class="font-bold" style="margin-bottom: 15px">Profile</div>

  <div class="flex flex-wrap items-end" style="gap: 16px 24px;">
    <div class="flex flex-col" style="min-width: 160px;">
      <label for="birthDate">Birthdate</label>
      <div style="margin-top: 5px;">
        <input id="birthDate" class="settings-input" type="date" bind:value={$birthDate} />
      </div>
    </div>
    <div class="flex flex-col flex-1" style="min-width: 220px;">
      <label for="expectedLongevity">Expected Longevity</label>
      <div class="flex items-center" style="margin-top: 8px; gap: 12px;">
        <input
          id="expectedLongevity"
          class="settings-range"
          type="range"
          min={longevityMin}
          max={LONGEVITY_MAX}
          step="1"
          bind:value={$expectedLongevity}
        />
        <span class="text-gray-400" style="font-size: 13px; min-width: 4.5em; white-space: nowrap;">
          {$expectedLongevity} years
        </span>
      </div>
    </div>
  </div>
</div>
