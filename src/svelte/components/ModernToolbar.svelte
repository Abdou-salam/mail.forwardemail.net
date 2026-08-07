<script lang='ts'>
  import Menu from '@lucide/svelte/icons/menu';
  import Search from '@lucide/svelte/icons/search';
  import BookUser from '@lucide/svelte/icons/book-user';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import ListTodo from '@lucide/svelte/icons/list-todo';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import Lock from '@lucide/svelte/icons/lock';
  import * as Tooltip from '$lib/components/ui/tooltip'; 
  import ThemeStyleToggle from './ThemeStyleToggle.svelte';
  import { folders } from '../../stores/folderStore';

  // --- PROPS ---
  export let toggleSidebar: () => void;
  export let sidebarOpen: boolean;
  
  // Reçoit la fonction navigate de mailbox.svelte
  export let navigate: (path: string) => void; 

  // Recherche
  export let query: any; 
  export let searchInputEl: HTMLInputElement | null;
  export let showSuggestions: () => void;
  export let hideSuggestions: () => void;
  export let onSearch: (val: string) => void;
  export let searchingStore: any; 
  export let searchSuggestionsVisible: boolean;
  export let filteredSuggestions: any[];
  export let applySuggestion: (val: string) => void;

  // États globaux
  export let isMobile: boolean;
  export let showHeaderShortcuts: boolean;
  export let syncProgress: any;  
  export let indexProgress: any; 
  export let isDarkMode: boolean;
  export let toggleTheme: () => void;

  // Sécurité et Profil
  export let isLockEnabled: () => boolean;
  export let isVaultConfigured: () => boolean;
  export let profileImageStore: any; 
  export let profileInitials: string;
  export let userEmail: string = 'demo@forwardemail.net';
  export let userName: string = 'Jean Dupont';

  /**
   * Encapsulation sécurisée de l'appel de navigation.
   * Utilise la prop navigate fournie, ou bascule sur la redirection standard si absente.
   */
  function handleNavigate(path: string) {
    if (typeof navigate === 'function') {
      navigate(path);
    } else {
      console.warn("[ModernToolbar] Prop 'navigate' manquante, redirection par défaut.");
      window.location.href = path;
    }
  }
  // [CUSTOM] Total unread across all folders, same source of truth as the
// sidebar's per-folder badges (folderStore.ts's `count` field, kept fresh
// by demo-mutations-overlay.ts's recomputeDemoFolderCounts). Drafts is
// excluded because its `count` represents the *total* draft count, not an
// unread count (see the isDrafts special-case there) — including it would
// inflate this badge with numbers that aren't actually unread messages.
//
// `count`/`totalCount` are added onto Folder objects at runtime by
// demo-mutations-overlay.ts and aren't part of the upstream Folder type
// (types/folder.ts), hence the local cast instead of extending that type.
$: totalUnread = ($folders || []).reduce((sum, f) => {
  const folder = f as unknown as { specialUse?: string; path?: string; count?: number };
  const isDrafts = folder.specialUse === '\\Drafts' || String(folder.path || '').toLowerCase() === 'drafts';
  if (isDrafts) return sum;
  return sum + (Number(folder.count) || 0);
}, 0);
</script>
<div class="fe-modern-toolbar-container flex items-center justify-between p-3 rounded-[24px] border transition-colors bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
 <!-- Logo -->
  <div class="fe-modern-logo-area flex items-center gap-3">
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="inline-flex items-center justify-center h-10 w-10 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 { sidebarOpen ? 'bg-zinc-100 dark:bg-zinc-800' : '' }"
          type="button"
          aria-label="Toggle sidebar"
          onclick={toggleSidebar}
        >
          <span class="inline-flex transition-transform duration-200 { sidebarOpen ? 'rotate-90' : '' }">
            <Menu class="h-5 w-5" />
          </span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content side="bottom">
        <p>Afficher/Masquer la barre latérale</p>
      </Tooltip.Content>
    </Tooltip.Root>

    <div class="fe-modern-logo-icon">
      <img src="{import.meta.env.BASE_URL}icons/logo-square.svg" alt="Forward Email" class="h-full w-full object-contain p-1.5" />
    </div>
    <span class="fe-modern-logo-text">Forward Email</span>
  </div>
  <!-- Barre de recherche -->
 <!-- Barre de recherche Modernisée et Réparée -->
  <div class="fe-modern-search-wrapper" class:hidden={isMobile}>
  <Search class="fe-modern-search-icon" />
  <input
    class="fe-modern-search-input"
      placeholder="Search mail"
      title="Search mail (Ctrl+K)"
      value={$query}
      bind:this={searchInputEl}
      onfocus={showSuggestions}
      onblur={hideSuggestions}
      oninput={(e) => {
        showSuggestions();
        onSearch(e.currentTarget.value);
      }}
    />
    
    {#if $searchingStore}
      <span
        class="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin rounded-full border-2 border-border border-t-primary"
      ></span>
      {:else}
      <span class="fe-modern-search-badge">⌘K</span>
    {/if}

    <!-- Fenêtre de suggestions (Dropdown réglé) -->
    {#if searchSuggestionsVisible && filteredSuggestions.length}
      <div
        class="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border shadow-lg p-2 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 max-h-[300px] overflow-y-auto rounded-md"
      >
        {#each filteredSuggestions as suggestion}
          <button
            type="button"
            class="flex items-center justify-between gap-2 px-2.5 py-2 border border-border bg-background text-sm cursor-pointer transition-colors rounded-sm hover:border-primary hover:bg-primary/5 text-left"
            data-type={suggestion.type || 'operator'}
            onmousedown={(e) => {
              e.preventDefault();
              applySuggestion(suggestion.value);
            }}
            title={suggestion.type === 'label'
              ? 'Label'
              : suggestion.type === 'saved'
                ? 'Saved search'
                : 'Operator'}
          >
            <span class="truncate">{suggestion.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <!-- Actions & Raccourcis -->
  <div class="fe-modern-actions-area">
    
    <!-- Sync & Index Progress -->
    {#if showHeaderShortcuts && ($syncProgress.active || $indexProgress.active)}
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground bg-accent/40 rounded-full shrink-0" role="status">
        <span class="h-2 w-2 animate-ping rounded-full bg-primary shrink-0"></span>
        {#if $syncProgress.active}
          <span class="truncate max-w-[100px] text-[11px]">Syncing...</span>
        {:else}
          <span class="truncate max-w-[100px] text-[11px]">Indexing...</span>
        {/if}
      </div>
    {/if}

    <!-- Raccourcis : Utilisation de handleNavigate sécurisé -->
    {#if showHeaderShortcuts}
      <div class="fe-modern-shortcuts">
        <button onclick={() => handleNavigate('/contacts')} title="Contacts">
          <BookUser class="h-4.5 w-4.5" />
        </button>
        
        <button onclick={() => handleNavigate('/calendar')} title="Calendar">
          <CalendarIcon class="h-4.5 w-4.5" />
        </button>
        
        <button onclick={() => handleNavigate('/calendar#tasks')} title="Tasks">
          <ListTodo class="h-4.5 w-4.5" />
        </button>
        
        <button onclick={() => handleNavigate('/mailbox/settings')} title="Settings">
          <SettingsIcon class="h-4.5 w-4.5" />
        </button>
        
        <button onclick={toggleTheme} title="Toggle theme">
          {#if isDarkMode}
            <Sun class="h-4.5 w-4.5" />
          {:else}
            <Moon class="h-4.5 w-4.5" />
          {/if}
        </button>

        {#if isLockEnabled() && isVaultConfigured()}
          <button onclick={() => window.dispatchEvent(new CustomEvent('fe:lock-app'))} title="Lock app">
            <Lock class="h-4.5 w-4.5" />
          </button>
        {/if}
      </div>
    {/if}

    <div class="fe-modern-style-toggle-wrapper">
      <ThemeStyleToggle />
    </div>

    {#if totalUnread > 0}
      <div class="fe-modern-notification-badge">{totalUnread > 99 ? '99+' : totalUnread}</div>
    {/if}

    <!-- Profil -->
<button 
  class="fe-modern-user-profile-btn flex items-center gap-3 p-1 pr-3 rounded-full border transition-colors bg-transparent text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800" 
  onclick={() => handleNavigate('/mailbox/profile')}
>
  <div class="fe-modern-avatar h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold shrink-0">
    {#if $profileImageStore}
      <img src={$profileImageStore} alt="Profile" class="h-full w-full rounded-full object-cover" />
    {:else}
      <span>{profileInitials || 'JD'}</span>
    {/if}
  </div>
  
  <div class="fe-modern-user-meta text-left" class:hidden={isMobile}>
    <span class="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none mb-0.5">{userName}</span>
    <span class="block text-xs text-zinc-500 dark:text-zinc-400 leading-none">{userEmail}</span>
  </div>
</button>
  </div>
</div>