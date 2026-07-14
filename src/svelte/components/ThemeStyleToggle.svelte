<script lang="ts">
  import { uiStyle, setUiStyle } from '../../stores/themeStyleStore';
</script>

<div class="fe-style-switch" role="tablist" aria-label="Style d'affichage">
  <button
    type="button"
    role="tab"
    aria-selected={$uiStyle === 'modern'}
    class:fe-style-on={$uiStyle === 'modern'}
    onclick={() => setUiStyle('modern')}
  >
    Moderne
  </button>
  <button
    type="button"
    role="tab"
    aria-selected={$uiStyle === 'classic'}
    class:fe-style-on={$uiStyle === 'classic'}
    onclick={() => setUiStyle('classic')}
  >
    Classique
  </button>
</div>

<style>
  .fe-style-switch {
    display: flex;
    padding: 3px;
    background: var(--muted, #eceef5);
    border-radius: 11px;
    gap: 2px;
  }
  .fe-style-switch button {
    padding: 7px 13px;
    border-radius: 8px;
    font-size: 11px;
    border: 0;
    background: transparent;
    color: var(--muted-foreground, #67677e);
    cursor: pointer;
  }
  .fe-style-switch button.fe-style-on {
    background: var(--background, #fff);
    color: var(--primary, #000091);
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(20, 20, 55, 0.1);
  }
</style>
