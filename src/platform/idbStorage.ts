import { openDB, type IDBPDatabase } from "idb";
import type { StoragePort } from "./ports";

const DB_NAME = "urbania";
const STORE = "kv";

export class IdbStorage implements StoragePort {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE);
      },
    });
  }

  async load(key: string): Promise<string | null> {
    const db = await this.db;
    const value = await db.get(STORE, key);
    return typeof value === "string" ? value : null;
  }

  async save(key: string, data: string): Promise<void> {
    const db = await this.db;
    await db.put(STORE, data, key);
  }

  async delete(key: string): Promise<void> {
    const db = await this.db;
    await db.delete(STORE, key);
  }

  async listKeys(prefix: string): Promise<string[]> {
    const db = await this.db;
    const keys = await db.getAllKeys(STORE);
    return keys
      .filter((k): k is string => typeof k === "string" && k.startsWith(prefix));
  }
}
