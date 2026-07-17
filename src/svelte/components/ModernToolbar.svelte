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
</script>

<div class="fe-modern-toolbar-container flex items-center justify-between p-3 rounded-[24px] border transition-colors bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
  <!-- Bouton Menu Hamburger (Mobile uniquement) -->
  <button
    class="inline-flex items-center justify-center h-10 w-10 md:hidden hover:bg-accent rounded-lg transition-colors"
    type="button"
    onclick={toggleSidebar}
    aria-label="Toggle sidebar"
  >
    <span class="inline-flex transition-transform duration-200" class:rotate-90={sidebarOpen}>
      <Menu class="h-5 w-5" />
    </span>
  </button>

  <!-- Logo -->
  <div class="fe-modern-logo-area" class:hidden={isMobile}>
    <div class="fe-modern-logo-icon"></div>
    <span class="fe-modern-logo-text">Forward Email</span>
  </div>

  <!-- Barre de recherche -->
 <!-- Barre de recherche Modernisée et Réparée -->
  <div class="relative flex-1 md:max-w-[420px]" class:hidden={isMobile}>
    <Search
      class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
    />
    <input
      type="search"
      class="pl-9 pr-8 h-9 w-full bg-background border border-border rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

    <div class="fe-modern-notification-badge">2</div>

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