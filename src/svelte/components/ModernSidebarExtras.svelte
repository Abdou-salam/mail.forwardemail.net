<div class="fe-sidebar-modern-container">
  
  <div class="fe-group-title">
    <span>Dossiers</span>
    <button type="button" class="fe-add-btn" aria-label="Ajouter un dossier">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>
  </div>

  <div class="fe-sub-list">
    <div class="fe-sub-item">
      <svg class="fe-sub-icon" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      Clients
    </div>
    <div class="fe-sub-item">
      <svg class="fe-sub-icon" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      Factures
    </div>
    <div class="fe-sub-item">
      <svg class="fe-sub-icon" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      Projets
    </div>
    <div class="fe-sub-item">
      <svg class="fe-sub-icon" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      Personnel
    </div>
    <div class="fe-sub-item">
      <svg class="fe-sub-icon" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      Voyage
    </div>
  </div>

  <div class="fe-group-title" style="margin-top: 22px;">
    <span>Libellés</span>
    <button type="button" class="fe-add-btn" aria-label="Ajouter un libellé">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>
  </div>

  <div class="fe-sub-list">
    <div class="fe-sub-item">
      <span class="fe-label-dot" style="--dot-color: #e1000f;"></span>
      Important
    </div>
    <div class="fe-sub-item">
      <span class="fe-label-dot" style="--dot-color: #000091;"></span>
      Travail
    </div>
    <div class="fe-sub-item">
      <span class="fe-label-dot" style="--dot-color: #7c3aed;"></span>
      Personnel
    </div>
    <div class="fe-sub-item">
      <span class="fe-label-dot" style="--dot-color: #ea580c;"></span>
      À traiter
    </div>
    <div class="fe-sub-item">
      <span class="fe-label-dot" style="--dot-color: #16a34a;"></span>
      En attente
    </div>
  </div>

</div>

<style>
  /* Base Container conforme à la maquette */
  .fe-sidebar-modern-container {
    padding: 12px 16px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  /* Titre de Section (Dossiers / Libellés) */
  .fe-group-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9c9cb0; /* var(--group-text) */
    margin-bottom: 8px;
    padding: 0 8px;
  }

  /* Bouton d'ajout + discret */
  .fe-add-btn {
    background: transparent;
    border: none;
    color: #9c9cb0;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .fe-add-btn:hover {
    background-color: #f2f3f9;
    color: #000091;
  }

  /* Liste d'items */
  .fe-sub-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* Item individuel (Client, Facture, etc.) */
  .fe-sub-item {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 38px;
    padding: 0 12px;
    font-size: 13.5px;
    font-weight: 500;
    color: #626279; /* var(--item-text) */
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .fe-sub-item:hover {
    background-color: #f2f3f9; /* var(--item-hover-bg) */
    color: #000091; /* var(--blue) */
  }

  /* Icône dossier */
  .fe-sub-icon {
    color: #9898ae; /* var(--item-icon) */
    flex-shrink: 0;
    transition: color 0.15s ease;
  }

  .fe-sub-item:hover .fe-sub-icon {
    color: #000091;
  }

  /* Pastilles de couleur pour les libellés */
  .fe-label-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--dot-color);
    flex-shrink: 0;
    box-shadow: 0 0 0 2px #ffffff, 0 0 0 3px var(--dot-color);
    margin-left: 4px;
    margin-right: 4px;
  }
</style>