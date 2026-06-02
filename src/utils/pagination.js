/**
 * Decide whether a folder has more messages to page into, given the locally
 * cached count and the server-reported total.
 *
 * The cached count alone caps pagination at whatever has been synced locally —
 * on desktop that stalls infinite scroll well before the folder's real end. We
 * also consult the server total so `hasNextPage` stays true when the server has
 * more; the next-page load then fetches it from the API (and the post-fetch
 * `list.length >= limit` check remains the authoritative correction).
 *
 * @param {object} args
 * @param {number} args.cachedCount  messages currently in the local cache for this folder
 * @param {number|null|undefined} args.serverTotal  folder.totalCount from the server (null when unknown)
 * @param {number} args.offset  zero-based index of the first item on the current page ((page-1)*limit)
 * @param {number} args.limit  page size
 * @returns {boolean}
 */
export function hasMorePages({ cachedCount, serverTotal, offset, limit }) {
  const end = offset + limit;
  const moreInCache = Number.isFinite(cachedCount) && cachedCount > end;
  const moreOnServer = Number.isFinite(serverTotal) && serverTotal > end;
  return moreInCache || moreOnServer;
}
