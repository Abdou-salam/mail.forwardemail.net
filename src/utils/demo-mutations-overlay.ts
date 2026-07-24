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
  }
  return masterMessages;
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
      return listForFolder(folder);
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

    return original(action, params, options);
  };
}