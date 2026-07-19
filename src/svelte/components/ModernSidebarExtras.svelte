<script lang="ts">
  import { onMount } from 'svelte';
  import type { Folder } from '$types';
  import { writable } from 'svelte/store';

  // IMPORTATION DU COMPOSANT DE LA MODALE
  import TagFolderModal from './TagFolderModal.svelte';

  // --- PROPS (SYNTAXE RUNES SVELTE 5) ---
  // Détecte dynamiquement si la page est en anglais ('en') ou en français ('fr')
  let currentLang = $derived(
    (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'fr') as 'en' | 'fr'
  );

  let {
    folders = $bindable([]),
    selectedFolder = '',
    folderActionModal,
    onSelectFolder,
    onDeleteFolder = undefined,
    onDeleteTag = undefined
  }: {
    folders: Folder[];
    selectedFolder: string;
    folderActionModal: { action: 'create' | 'rename'; folder: any | null } | null;
    onSelectFolder: (path: string) => void;
    onDeleteFolder?: (folder: Folder) => void;
    onDeleteTag?: (tag: { name: string; color: string }) => void;
  } = $props();
  
  export const tags = writable([{ name: 'Important', color: '#e1000f' }]);

  // --- ÉTATS D'AFFICHAGE DU COMPOSANT INJECTÉ ---
  let isGlobalModalOpen = $state(false);
  let globalModalType: 'folder' | 'tag' = $state('folder');

  // --- ACTION PORTAL POUR TÉLÉPORTER LA MODALE AU PREMIER PLAN ---
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    };
  }

  // --- ÉCOUTE DES ÉVÉNEMENTS GLOBAUX ---
  onMount(() => {
    const handleOpenModal = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: 'folder' | 'tag' }>;
      globalModalType = customEvent.detail.type;
      isGlobalModalOpen = true;
    };

    const handleFolderSubmit = (e: Event) => {
      const customEvent = e as CustomEvent<{ name: string }>;
      const folderName = customEvent.detail.name;
      
      folders = [
        ...folders, 
        { 
          id: 'test-id-' + Date.now(),
          account: 'demo@forwardemail.net',
          name: folderName, 
          path: folderName.toLowerCase().replace(/\s+/g, '-')
        }
      ];
    };

    const handleTagSubmit = (e: Event) => {
      const customEvent = e as CustomEvent<{ name: string }>;
      const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
      
      tags.update(allTags => [
        ...allTags, 
        { 
          name: customEvent.detail.name, 
          color: randomColor 
        }
      ]);
    };

    window.addEventListener('custom:open-creation-modal', handleOpenModal);
    window.addEventListener('custom:create-folder-submit', handleFolderSubmit);
    window.addEventListener('custom:create-tag-submit', handleTagSubmit);

    return () => {
      window.removeEventListener('custom:open-creation-modal', handleOpenModal);
      window.removeEventListener('custom:create-folder-submit', handleFolderSubmit);
      window.removeEventListener('custom:create-tag-submit', handleTagSubmit);
    };
  });

  // --- LOGIQUE DE DÉCLENCHEMENT DEPUIS LES BOUTONS DE LA SIDEBAR ---
  function handleAddFolderClick() {
    window.dispatchEvent(new CustomEvent('custom:open-creation-modal', { detail: { type: 'folder' } }));
  }

  function handleCreateTag() {
    window.dispatchEvent(new CustomEvent('custom:open-creation-modal', { detail: { type: 'tag' } }));
  }

  function handleDeleteFolderClick(e: MouseEvent, folderToRemove: Folder) {
    e.stopPropagation();
    if (onDeleteFolder) onDeleteFolder(folderToRemove);
    folders = folders.filter(folder => folder.id !== folderToRemove.id);
  }

  function handleDeleteTagClick(e: MouseEvent, tagToRemove: { name: string; color: string }) {
    e.stopPropagation();
    if (onDeleteTag) onDeleteTag(tagToRemove);
    tags.update(allTags => allTags.filter(tag => tag.name !== tagToRemove.name));
  }
</script>

<div class="fe-sidebar-modern-container">
  
  <!-- SECTION DOSSIERS -->
  <div class="fe-group-title">
    <span>Dossiers</span>
    <button 
      type="button" 
      class="fe-add-btn" 
      aria-label="Ajouter un dossier"
      onclick={handleAddFolderClick}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>
  </div>

  <div class="fe-sub-list">
  {#each folders as folder (folder.id)}
    <div
      role="button"
      tabindex="0"
      class="fe-sub-item { selectedFolder === folder.path ? 'fe-active' : '' }"
      onclick={() => onSelectFolder(folder.path)}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectFolder(folder.path)}
    >
      <svg class="fe-sub-icon" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      <span class="fe-folder-name">{folder.name || folder.path}</span>
      
      <button 
        type="button" 
        class="fe-delete-inline-btn"
        aria-label="Supprimer le dossier"
        onclick={(e) => handleDeleteFolderClick(e, folder)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  {:else}
    <div class="fe-empty-state">Aucun dossier</div>
  {/each}
  </div>

  <!-- SECTION LIBELLÉS -->
  <div class="fe-group-title" style="margin-top: 16px;">
    <span>Libellés</span>
    <button 
      type="button" 
      class="fe-add-btn" 
      onclick={handleCreateTag}
      aria-label="Ajouter un libellé"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>
  </div>

  <div class="fe-sub-list">
    {#each $tags as tag}
      <div class="fe-sub-item">
        <span class="fe-label-dot" style="--dot-color: {tag.color};"></span>
        <span class="fe-folder-name">{tag.name}</span>

        <button 
          type="button" 
          class="fe-delete-inline-btn"
          aria-label="Supprimer le libellé"
          onclick={(e) => handleDeleteTagClick(e, tag)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    {:else}
      <div class="fe-empty-state">Aucun libellé</div>
    {/each}
  </div>

</div>

{#if isGlobalModalOpen}
  <div use:portal>
    <TagFolderModal 
      type={globalModalType} 
      lang={currentLang} 
      onClose={() => isGlobalModalOpen = false} 
    />
  </div>
{/if}

<style>
  /* Base Container — carte flottante avec glass léger */
  .fe-sidebar-modern-container {
    padding: 14px 12px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: color-mix(in srgb, var(--surface-default, #fff) 92%, transparent);
    backdrop-filter: blur(12px) saturate(160%);
    border-radius: 18px;
    border: 1px solid color-mix(in srgb, var(--border, #e5e7eb) 60%, transparent);
    box-shadow: 0 8px 24px rgba(20, 20, 60, 0.06);
  }

  /* Titre de Section */
  .fe-group-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #9c9cb0;
    margin-bottom: 10px;
    padding: 0 6px;
  }

  /* Bouton d'ajout — cercle plein au survol */
  .fe-add-btn {
    background: transparent;
    border: none;
    color: #9c9cb0;
    cursor: pointer;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    transition: background-color 0.18s ease, color 0.18s ease, transform 0.15s ease;
  }

  .fe-add-btn:hover {
    background: linear-gradient(135deg, #000091, #4338ca);
    color: #fff;
    transform: scale(1.08);
  }

  /* Liste d'items */
  .fe-sub-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  /* Item individuel — pilule arrondie */
  .fe-sub-item {
    display: flex;
    align-items: center;
    gap: 11px;
    height: 40px;
    padding: 0 12px;
    font-size: 13.5px;
    font-weight: 500;
    color: #626279;
    border-radius: 12px;
    cursor: pointer;
    transition: background-color 0.18s ease, color 0.18s ease, transform 0.1s ease;
  }

  .fe-sub-item:hover {
    background-color: color-mix(in srgb, #000091 6%, transparent);
    color: #000091;
    transform: translateX(2px);
  }

  /* Icône dossier */
  .fe-sub-icon {
    color: #9898ae;
    flex-shrink: 0;
    transition: color 0.18s ease;
  }

  .fe-sub-item:hover .fe-sub-icon {
    color: #000091;
  }

  /* Pastilles de libellés — halo lumineux plus marqué */
  .fe-label-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background-color: var(--dot-color);
    flex-shrink: 0;
    box-shadow:
      0 0 0 2px #ffffff,
      0 0 0 3.5px var(--dot-color),
      0 0 8px 1px color-mix(in srgb, var(--dot-color) 55%, transparent);
    margin: 0 2px;
  }

  .fe-folder-name {
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Bouton de suppression — apparition douce au survol */
  .fe-delete-inline-btn {
    background: transparent;
    border: none;
    color: #9c9cb0;
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    margin-left: auto;
    opacity: 0;
    transform: scale(0.85);
    transition: opacity 0.15s ease, transform 0.15s ease, background-color 0.15s ease, color 0.15s ease;
  }

  .fe-sub-item:hover .fe-delete-inline-btn {
    opacity: 1;
    transform: scale(1);
  }

  .fe-delete-inline-btn:hover {
    background-color: #fee2e4;
    color: #d92d20;
  }

  /* État actif — pilule pleine avec ombre douce */
  .fe-sub-item.fe-active {
    background: linear-gradient(135deg, color-mix(in srgb, #000091 10%, transparent), color-mix(in srgb, #4338ca 8%, transparent));
    color: #000091;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(0, 0, 145, 0.08);
  }
  
  .fe-sub-item.fe-active .fe-sub-icon {
    color: #000091;
  }

  /* État vide — plus discret et centré */
  .fe-empty-state {
    text-align: center;
    padding: 14px 8px;
    font-size: 12px;
    color: #a1a1aa;
    font-style: italic;
  }
</style>
