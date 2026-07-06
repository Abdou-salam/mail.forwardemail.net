/** Type declarations for db-crypto-bridge.js (main-thread App Lock ↔ DB engine glue). */

export function initDbCryptoBridge(): Promise<void>;
export function syncDbCryptoState(): Promise<void>;
export function encryptAllIdbData(): Promise<Record<string, number> | null>;
export function decryptAllIdbData(): Promise<Record<string, number> | null>;
