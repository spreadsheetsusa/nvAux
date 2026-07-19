<script>
  import { fullScreen, windowed, isMobile } from '$lib/store';

  let isAppFullscreen = $derived($fullScreen && (!$windowed || $isMobile));
</script>

<div
  class="status-bar px-2 items-center flex absolute w-full flex-grow-0 transition-all"
  style="font-size: 12px; background: var(--app-statusbar-background); bottom: 0; left: 0; color: #606060; border-top: 1px solid var(--app-statusbar-border); height: {isAppFullscreen ? '45px' : '34px'};"
>
  <div class="flex-grow flex items-center">nvAux v0.1.7-20260716-001</div>
</div>

<style>
  @media screen and (max-width: 768px) {
    .status-bar {
      align-items: start;
      padding-top: 10px;
    }
  }

  @media screen and (min-width: 769px) {
    .status-bar {
      align-items: center;
    }
  }
</style>
