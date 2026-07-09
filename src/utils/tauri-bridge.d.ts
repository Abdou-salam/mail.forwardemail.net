/** Type declarations for tauri-bridge.js (thin wrapper over Tauri invoke/plugins). */

export function isTauri(): boolean;
export function invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
export function listen(
  eventName: string,
  handler: (event: { payload: unknown }) => void,
): Promise<() => void>;
export function emit(eventName: string, payload?: unknown): Promise<void>;

export function getAppVersion(): Promise<string>;
export function getPlatform(): Promise<string>;
export function getBuildInfo(): Promise<Record<string, string> | null>;

export function readRecentLogs(maxBytes?: number): Promise<string>;
export function getLogPath(): Promise<string>;
export function clearLogs(): Promise<void>;

export function setBadgeCount(count: number): Promise<void>;
export function toggleWindowVisibility(): Promise<void>;
export function isDefaultMailtoHandler(): Promise<boolean>;
export function setDefaultMailtoHandler(): Promise<boolean>;

export function onDeepLink(handler: (url: string) => void): Promise<() => void>;
export function onSingleInstance(handler: (args: unknown) => void): Promise<() => void>;
export function onBackButton(handler: () => void): Promise<() => void>;
export function triggerHaptic(style?: string): void;
export function onShareReceived(handler: (data: unknown) => void): () => void;
export function getPendingDeepLinks(): Promise<string[]>;
export function initTauriBridge(): Promise<void>;
