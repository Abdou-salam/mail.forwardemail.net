<script lang="ts">
  // --- PROPS & ÉVÉNEMENTS (Syntaxe Svelte 5) ---
  interface Props {
    type: 'folder' | 'tag';
    lang?: 'fr' | 'en'; 
    onClose: () => void;
  }

  let { type = 'folder', lang, onClose }: Props = $props();

  // --- DÉTECTION HYBRIDE ET ROBUSTE DE LA LANGUE DE L'UTILISATEUR ---
  const resolvedLang = $derived(
    lang || 
    (typeof navigator !== 'undefined' && navigator.language.startsWith('fr') ? 'fr' : 'en')
  );

  // --- DICTIONNAIRE I18N BILINGUE ET RÉACTIF ---
  const translations = {
    fr: {
      folder: {
        title: 'Créer un dossier',
        label: 'Nom du dossier',
        placeholder: 'Ex: Factures, Clients...',
        submit: 'Créer le dossier'
      },
      tag: {
        title: 'Créer un libellé',
        label: 'Nom du libellé',
        placeholder: 'Ex: Important, À traiter...',
        submit: 'Créer le libellé'
      },
      common: {
        cancel: 'Annuler'
      }
    },
    en: {
      folder: {
        title: 'Create a folder',
        label: 'Folder name',
        placeholder: 'e.g., Invoices, Clients...',
        submit: 'Create folder'
      },
      tag: {
        title: 'Create a tag',
        label: 'Tag name',
        placeholder: 'e.g., Important, Todo...',
        submit: 'Create tag'
      },
      common: {
        cancel: 'Cancel'
      }
    }
  };

  const content = $derived(translations[resolvedLang][type]);
  const commonText = $derived(translations[resolvedLang].common);

  // --- ÉTATS ---
  let inputValue = $state('');

  /**
   * Action Svelte alternative à l'attribut autofocus pour l'accessibilité
   */
  function focusInput(node: HTMLInputElement) {
    node.focus();
  }

  /**
   * Soumission du formulaire
   */
  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (type === 'folder') {
      window.dispatchEvent(new CustomEvent('custom:create-folder-submit', {
        detail: { name: inputValue.trim() }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('custom:create-tag-submit', {
        detail: { name: inputValue.trim() }
      }));
    }

    onClose();
  }

  /**
   * Gestion de la fermeture globale sur appui de la touche Échap
   */
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  /**
   * Gestion du clic clavier sur l'overlay (Accessibilité)
   */
  function handleOverlayKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Overlay avec comportement clavier explicite ajouté pour l'accessibilité -->
<div 
  class="fe-modal-overlay notranslate" 
  translate="no"
  onclick={onClose} 
  onkeydown={handleOverlayKeyDown}
  role="presentation"
>
  <!-- Ajout du tabindex="-1" obligatoire pour le rôle interactif dialog -->
  <div 
    class="fe-modal-content" 
    onclick={(e) => e.stopPropagation()} 
    onkeydown={(e) => e.stopPropagation()}
    role="dialog" 
    aria-modal="true"
    tabindex="-1"
  >
    <div class="fe-modal-header">
      <h2>{content.title}</h2>
      <button 
        type="button" 
        class="fe-modal-close" 
        onclick={onClose}
        aria-label="Fermer la fenêtre"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    
    <form onsubmit={handleSubmit}>
      <div class="fe-form-group">
        <label for="modalInput">
          {content.label}
        </label>
        <input 
          type="text" 
          id="modalInput" 
          placeholder={content.placeholder} 
          bind:value={inputValue}
          use:focusInput
          required
        />
      </div>
      
      <div class="fe-modal-actions">
        <button 
          type="button" 
          class="fe-btn-cancel" 
          onclick={onClose}
        >
          {commonText.cancel}
        </button>
        <button 
          type="submit" 
          class="fe-btn-submit"
        >
          {content.submit}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .fe-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(15, 23, 42, 0.15);
    backdrop-filter: blur(12px) saturate(160%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999 !important;
  }

  .fe-modal-content {
    background-color: #ffffff;
    border-radius: 18px;
    width: 100%;
    max-width: 480px;
    padding: 28px;
    border: 1px solid color-mix(in srgb, #e5e7eb 60%, transparent);
    box-shadow: 0 20px 40px rgba(20, 20, 60, 0.1);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    outline: none;
  }

  .fe-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 22px;
  }

  .fe-modal-header h2 {
    font-size: 18px;
    font-weight: 700;
    color: #1e1e2f;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .fe-modal-close {
    background: transparent;
    border: none;
    color: #9c9cb0;
    cursor: pointer;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    transition: background-color 0.18s ease, color 0.18s ease, transform 0.15s ease;
  }

  .fe-modal-close:hover {
    background-color: #f2f3f9;
    color: #000091;
    transform: scale(1.05);
  }

  .fe-form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .fe-form-group label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9c9cb0;
    padding: 0 2px;
  }

  .fe-form-group input {
    width: 100%;
    height: 44px;
    padding: 0 14px;
    font-size: 14px;
    font-weight: 500;
    color: #626279;
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
  }

  .fe-form-group input:focus {
    background-color: #ffffff;
    border-color: #000091;
    box-shadow: 0 0 0 4px color-mix(in srgb, #000091 12%, transparent);
  }

  .fe-modal-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
  }

  .fe-btn-cancel {
    background-color: transparent;
    border: none;
    font-size: 13.5px;
    font-weight: 600;
    color: #626279;
    cursor: pointer;
    padding: 10px 18px;
    border-radius: 12px;
    transition: background-color 0.18s ease, color 0.18s ease;
  }

  .fe-btn-cancel:hover {
    background-color: #f2f3f9;
    color: #000091;
  }

  .fe-btn-submit {
    background: linear-gradient(135deg, #000091, #4338ca);
    border: none;
    font-size: 13.5px;
    font-weight: 700;
    color: #ffffff;
    cursor: pointer;
    padding: 10px 22px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 145, 0.15);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .fe-btn-submit:hover {
    transform: scale(1.02);
    box-shadow: 0 6px 16px rgba(0, 0, 145, 0.22);
  }
</style>