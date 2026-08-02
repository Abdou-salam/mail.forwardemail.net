/**
 * CUSTOM: Makes delete/archive/move feel real in the demo sandbox by
 * monkey-patching Remote.request. Never edits demo-mode.js or
 * mailboxStore.ts — it intercepts calls one layer above them.
 *
 * Key fix: demo-data.js regenerates fresh objects (with fresh timestamps)
 * on every call to generateMessages(). That breaks reference/ordering
 * stability across the header-update and body-fetch calls that happen
 * right after a delete/move, causing them to show different messages.
 * We snapshot the demo dataset ONCE per session and only mutate that
 * snapshot (delete/move), never regenerate it.
 */
import { Remote } from './remote';
import { isDemoMode } from './demo-mode';
import { generateMessages } from './demo-data';
import { selectedMessage, messageBody } from '../stores/messageStore';
import { folderMessageCache } from '../stores/folder-message-cache';
import { normalizeMessageForCache } from './sync-helpers'; // [CUSTOM FIX] reused read-only — see scheduleDexieSync
import { db } from './db'; // [CUSTOM FIX]
import { Local } from './storage'; // [CUSTOM FIX]

const ALL_FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Spam', 'Trash', 'Archive'];

let toastsRef: { show: (msg: string, type?: string) => void } | null = null;
export function setOverlayToasts(toasts: typeof toastsRef) {
  toastsRef = toasts;
}

// CUSTOM: one stable snapshot for the whole demo session — never regenerated.
let masterMessages: any[] | null = null;
function getMasterMessages(): any[] {
  if (!masterMessages) {
    const all: any[] = [];
    ALL_FOLDERS.forEach((folder) => {
      const msgs = generateMessages(folder, 1);
      if (Array.isArray(msgs)) {
        msgs.forEach((m: any) => {
          all.push({ ...m, folder, mailbox: folder });
        });
      }
    });
    masterMessages = all;
    scheduleDexieSync(); // [CUSTOM FIX] initial snapshot → mirror into Dexie
  }
  return masterMessages;
}

// [CUSTOM FIX] Mirrors the demo message snapshot into IndexedDB (Dexie).
//
// Why: stores/searchStore.ts queries db.messages directly whenever a search
// has no free-text term (e.g. toggling "Unread only" alone builds the query
// "is:unread", which has text === ''). Demo mode never writes to Dexie by
// design (see the "so skip the db.messages read/write entirely" comments in
// mailboxStore.ts) — real messages are kept purely in-memory. That combo
// meant is:unread / is:starred / has:attachment silently returned zero
// results in demo mode, even though the visible list clearly had matches.
//
// Fix: keep Dexie in sync with our in-memory snapshot, using
// normalizeMessageForCache — the exact same normalizer the real sync
// pipeline uses — so is_unread / is_unread_index / is_starred / is_flagged /
// has_attachment are always populated consistently. This requires zero
// changes to any upstream file (messageStore.ts, mailboxStore.ts,
// searchStore.ts, search-query.js, sync-helpers.ts all stay untouched).
let dexieSyncScheduled = false;
function scheduleDexieSync() {
  if (dexieSyncScheduled) return;
  dexieSyncScheduled = true;
  Promise.resolve().then(async () => {
    dexieSyncScheduled = false;
    try {
      const account = Local.get('email') || 'default';
      const records = getMasterMessages().map((m) =>
        normalizeMessageForCache(m, m.folder, account),
      );
      if (records.length) {
        await db.messages.bulkPut(records);
      }
    } catch {
      // Best-effort mirror. If this fails, local filter-only search simply
      // falls back to zero results as before — nothing else breaks.
    }
  });
}

/**
 * Extrait l'ID du message de manière robuste (params, options ou URL)
 */
function extractMessageId(params: any, options: any): string | null {
  if (params?.id != null) return String(params.id);
  if (params?.messageId != null) return String(params.messageId);
  if (Array.isArray(params?.ids) && params.ids.length > 0) return String(params.ids[0]);
  
  const match = options?.pathOverride?.match(/\/v1\/messages\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Vide le cache de dossiers pour forcer le rafraîchissement des listes
 */
function invalidateCaches() {
  if (folderMessageCache && typeof folderMessageCache.clear === 'function') {
    folderMessageCache.clear();
  }
}

/**
 * Vide la sélection du lecteur et nettoie l'URL
 */
function clearReaderSelection() {
  selectedMessage.set(null);
  messageBody.set('');
  invalidateCaches();

  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    let modified = false;

    if (url.searchParams.has('id')) {
      url.searchParams.delete('id');
      modified = true;
    }
    if (url.searchParams.has('messageId')) {
      url.searchParams.delete('messageId');
      modified = true;
    }
    if (url.hash.includes('/messages/')) {
      url.hash = '#/';
      modified = true;
    }

    if (modified) {
      window.history.replaceState({}, '', url.toString());
    }
  }
}

let installed = false;

export function installDemoMutationsOverlay() {
  if (installed) return;
  installed = true;

  const original = Remote.request.bind(Remote);

  const listForFolder = (folder: string) =>
    getMasterMessages().filter(
      (m) => (m.folder || '').toUpperCase() === String(folder).toUpperCase(),
    );

  Remote.request = async (action: string, params: any = {}, options: any = {}) => {
    if (!isDemoMode()) return original(action, params, options);

    if (action === 'MessageDelete') {
      const id = extractMessageId(params, options);
      if (id) {
        const list = getMasterMessages();
        const idx = list.findIndex((m) => String(m.id) === String(id));
        if (idx !== -1) {
          list.splice(idx, 1);
          scheduleDexieSync(); // [CUSTOM FIX] keep Dexie mirror in sync after delete
        }

        clearReaderSelection();
        toastsRef?.show?.('Deleted', 'success');
      }
      return { ok: true, demo: true };
    }

    if (action === 'MessageUpdate' && params?.folder && !params?.flags?.length) {
      const id = extractMessageId(params, options);
      const targetFolder = String(params.folder).toLowerCase();

      if (id) {
        const list = getMasterMessages();
        const msg = list.find((m) => String(m.id) === String(id));
        if (msg) {
          msg.folder = params.folder;
          msg.mailbox = params.folder;
          clearReaderSelection();
          scheduleDexieSync(); // [CUSTOM FIX] keep Dexie mirror in sync after move
        }
      }
      
      let actionName = 'Moved';
      if (targetFolder === 'archive') {
        actionName = 'Archived';
      } else if (targetFolder === 'trash' || targetFolder === 'corbeille') {
        actionName = 'Deleted';
      }

      toastsRef?.show?.(actionName, 'success');
      return { ok: true, demo: true };
    }

    if (action === 'MessageList') {
      const folder = params?.folder || params?.mailbox || params?.path || 'INBOX';
      let list = listForFolder(folder);

      // CUSTOM: Analyse robuste de la recherche ou des filtres passés en paramètre
      const searchParam = String(params?.search || params?.query || params?.q || '').toLowerCase();

      const wantUnread = 
        searchParam.includes('is:unread') || 
        params?.is_unread || 
        params?.unread || 
        params?.isUnread || 
        params?.unreadOnly || 
        params?.filters?.is_unread || 
        params?.filters?.unreadOnly ||
        params?.filters?.isUnread;

      const wantStarred = 
        searchParam.includes('is:starred') || 
        searchParam.includes('is:flagged') || 
        params?.is_starred || 
        params?.is_flagged || 
        params?.isStarred || 
        params?.starredOnly ||
        params?.filters?.is_starred;

      const wantAttachment = 
        searchParam.includes('has:attachment') || 
        params?.has_attachments || 
        params?.hasAttachment || 
        params?.hasAttachmentsOnly ||
        params?.filters?.has_attachments;

      const cleanQuery = searchParam
        .replace(/is:unread/g, '')
        .replace(/is:starred/g, '')
        .replace(/is:flagged/g, '')
        .replace(/has:attachment/g, '')
        .trim();

      list = list.filter((m) => {
        const isUnread = !m.flags?.includes('\\Seen') && m.is_unread !== false;
        const isStarred = m.is_starred || m.flags?.includes('\\Flagged');
        const hasAttachment = m.has_attachment || m.attachments?.length > 0;

        if (wantUnread && !isUnread) return false;
        if (wantStarred && !isStarred) return false;
        if (wantAttachment && !hasAttachment) return false;

        if (cleanQuery) {
          const matchSubject = m.subject?.toLowerCase().includes(cleanQuery);
          const matchFrom = m.from?.toLowerCase().includes(cleanQuery);
          const matchSnippet = m.snippet?.toLowerCase().includes(cleanQuery);
          if (!matchSubject && !matchFrom && !matchSnippet) return false;
        }

        return true;
      });

      return list;
    }

    // CUSTOM: Intercepter l'action Search globale si elle est appelée
    if (action === 'Search') {
      const queryStr = String(params?.query || params?.q || '').toLowerCase();
      const folder = params?.folder;
      
      const targetFolders = folder ? [folder] : ALL_FOLDERS;
      
      let allMessages: any[] = [];
      targetFolders.forEach((f) => {
        const msgs = listForFolder(f);
        if (Array.isArray(msgs)) {
          msgs.forEach((m) => allMessages.push({ ...m, folder: f, mailbox: f }));
        }
      });

      const wantUnread = 
        queryStr.includes('is:unread') || 
        params?.is_unread || 
        params?.unread || 
        params?.isUnread || 
        params?.unreadOnly || 
        params?.filters?.is_unread || 
        params?.filters?.unreadOnly ||
        params?.filters?.isUnread;

      const wantStarred = 
        queryStr.includes('is:starred') || 
        queryStr.includes('is:flagged') || 
        params?.is_starred || 
        params?.is_flagged || 
        params?.isStarred || 
        params?.starredOnly ||
        params?.filters?.is_starred;

      const wantAttachment = 
        queryStr.includes('has:attachment') || 
        params?.has_attachments || 
        params?.hasAttachment || 
        params?.hasAttachmentsOnly ||
        params?.filters?.has_attachments;
      
      const cleanQuery = queryStr
        .replace(/is:unread/g, '')
        .replace(/is:starred/g, '')
        .replace(/is:flagged/g, '')
        .replace(/has:attachment/g, '')
        .trim();

      return allMessages.filter((m) => {
        const isUnread = !m.flags?.includes('\\Seen') && m.is_unread !== false;
        const isStarred = m.is_starred || m.flags?.includes('\\Flagged');
        const hasAttachment = m.has_attachment || m.attachments?.length > 0;

        if (wantUnread && !isUnread) return false;
        if (wantStarred && !isStarred) return false;
        if (wantAttachment && !hasAttachment) return false;

        if (cleanQuery) {
          const matchSubject = m.subject?.toLowerCase().includes(cleanQuery);
          const matchFrom = m.from?.toLowerCase().includes(cleanQuery);
          const matchSnippet = m.snippet?.toLowerCase().includes(cleanQuery);
          if (!matchSubject && !matchFrom && !matchSnippet) return false;
        }

        return true;
      });
    }

    if (action === 'Message' && params?.id) {
      return getMasterMessages().find((m) => String(m.id) === String(params.id)) || null;
    }

    if (action === 'Folders') {
      const base = (await original(action, params, options)) as any[];
      return (base || []).map((f) => {
        const msgs = listForFolder(f.path);
        const unseen = msgs.filter((m) => !m.flags?.includes('\\Seen')).length;
        return { ...f, unseen, messages: msgs.length };
      });
    }

    if (action === 'AccountUpdate' && params?.settings?.label_settings) {
      // [CUSTOM FIX] Label create/update/delete (settingsStore.ts::createLabel/
      // updateLabel/deleteLabel) apply optimistically client-side — they update
      // settingsLabels and cacheLabels() BEFORE this call — then persist via a
      // generic Remote.request('AccountUpdate', { settings: { label_settings }}).
      // demo-mode.js blocks ALL 'AccountUpdate' calls with a "not available in
      // demo" toast (WRITE_ACTIONS), which fired here even though the label
      // change already succeeded locally with nothing left to actually block.
      // We detect label-only payloads via the label_settings key (the one shape
      // settingsStore.ts uses exclusively for label mutations) and let just
      // those through silently, leaving every other AccountUpdate (real account
      // settings, e.g. signature/theme) blocked as before.
      return { ok: true, demo: true };
    }

    return original(action, params, options);
  };
}