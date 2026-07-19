<script>
  import { db } from '$lib/store';
  import AbstractlyLogo from './AbstractlyLogo.svelte';
  import SettingsGeneral from './SettingsGeneral.svelte';
  import SettingsProfile from './SettingsProfile.svelte';
  import SettingsLock from './SettingsLock.svelte';
  import SettingsEncryption from './SettingsEncryption.svelte';
  import SettingsImportExport from './SettingsImportExport.svelte';
  import SettingsDangerZone from './SettingsDangerZone.svelte';
</script>

<div class="text-white h-full" style="padding: 5px 15px; margin: 0;">
  <span class="font-bold">nvAux Settings</span>
  <div class="relative">
    {#await db().then((database) => database.notes.find().exec())}
      <p>...waiting</p>
    {:then notes}
      <p><span class="text-gray-400">Total Notes:</span> {notes.length}</p>
    {:catch error}
      <p style="color: red">{error.message}</p>
    {/await}

    <SettingsGeneral />
    <SettingsProfile />
    <SettingsLock />
    <SettingsEncryption />
    <SettingsImportExport />
    <SettingsDangerZone />
  </div>

  <div class="text-center" style="padding-bottom: 300px;">
    <p class="items-center flex justify-center" style="margin-top: 100px; text-align: center; color: #5c6269; font-size: 11px; flex-wrap: wrap;">
      <span>Designed and Built by</span>
      <span class="relative" style="display: inline-block; height: 30px; width: 80px; top: 2px;"><a href="https://abstractly.io" target="_blank">
        <span class="flex items-center">
          <AbstractlyLogo />
        </span>
      </a></span> <span>The Human Interface Company.</span>
    </p>
    <p style="margin-top: 20px; color: #5c6269; font-size: 12px;">Hack on
      <a href="https://github.com/matterofabstract/nvaux" target="_blank" style="color: var(--app-accent); text-decoration: underline;">
        nvAux @ GitHub
      </a>
    </p>
  </div>
</div>
