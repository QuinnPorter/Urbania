/**
 * Platform seams. Web implementations live next to this file; a future
 * Capacitor build swaps in native implementations without touching game code.
 */

export interface StoragePort {
  load(key: string): Promise<string | null>;
  save(key: string, data: string): Promise<void>;
  delete(key: string): Promise<void>;
  listKeys(prefix: string): Promise<string[]>;
}

export interface ClipboardPort {
  write(text: string): Promise<void>;
  read(): Promise<string>;
}
