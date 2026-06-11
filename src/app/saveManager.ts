import { nanoid } from "nanoid";
import { City } from "../core/model/city";
import type { StoragePort } from "../platform/ports";
import {
  deserializeCity,
  serializeCity,
  type SaveCurrent,
} from "../core/save/serialize";
import { migrateSave } from "../core/save/migrate";

const SLOT_PREFIX = "city:";
const META_KEY = "meta";
const AUTOSAVE_DEBOUNCE_MS = 1500;

export interface SlotMeta {
  id: string;
  name: string;
  updatedAt: number;
  population: number;
}

interface MetaIndex {
  slots: SlotMeta[];
  /** Slot to open on next launch. */
  lastOpened?: string;
}

/**
 * Owns the active slot, autosave, and the slot index. UI talks to this;
 * this talks to StoragePort.
 */
export class SaveManager {
  private storage: StoragePort;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private activeId: string | null = null;
  private createdAt = 0;
  private getPopulation: () => number;

  constructor(storage: StoragePort, getPopulation: () => number) {
    this.storage = storage;
    this.getPopulation = getPopulation;
  }

  get activeSlotId(): string | null {
    return this.activeId;
  }

  /** Attach to a city: autosave on every change (debounced). */
  trackCity(city: City, slotId: string, createdAt: number): () => void {
    this.activeId = slotId;
    this.createdAt = createdAt;
    const save = () => this.scheduleSave(city);
    const unsubscribe = city.onChanged(save);

    const flush = () => {
      if (document.visibilityState === "hidden") void this.saveNow(city);
    };
    const pageHide = () => void this.saveNow(city);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", pageHide);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", pageHide);
    };
  }

  private scheduleSave(city: City): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.saveNow(city), AUTOSAVE_DEBOUNCE_MS);
  }

  async saveNow(city: City): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.activeId) return;
    const save = serializeCity(city, this.activeId, this.createdAt, Date.now());
    await this.storage.save(SLOT_PREFIX + this.activeId, JSON.stringify(save));
    await this.updateMeta({
      id: this.activeId,
      name: city.name,
      updatedAt: save.updatedAt,
      population: this.getPopulation(),
    });
    // One-time persistence request to resist eviction (best-effort).
    void navigator.storage?.persist?.();
  }

  async listSlots(): Promise<SlotMeta[]> {
    const meta = await this.readMeta();
    return meta.slots.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async lastOpenedId(): Promise<string | null> {
    return (await this.readMeta()).lastOpened ?? null;
  }

  async setLastOpened(id: string): Promise<void> {
    const meta = await this.readMeta();
    meta.lastOpened = id;
    await this.storage.save(META_KEY, JSON.stringify(meta));
  }

  async loadSlot(id: string): Promise<{ city: City; createdAt: number } | null> {
    const raw = await this.storage.load(SLOT_PREFIX + id);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Back up before migrating, in case a migration is buggy.
    const version = (parsed as { v?: number }).v ?? 0;
    if (version !== 0 && version < CURRENT_VERSION()) {
      await this.storage.save(`backup:${id}`, raw);
    }
    const save = migrateSave(parsed);
    return { city: deserializeCity(save), createdAt: save.createdAt };
  }

  /** Create + persist a brand new slot for the given city. */
  async createSlot(city: City): Promise<string> {
    const id = nanoid(10);
    this.activeId = id;
    this.createdAt = Date.now();
    await this.saveNow(city);
    await this.setLastOpened(id);
    return id;
  }

  async deleteSlot(id: string): Promise<void> {
    await this.storage.delete(SLOT_PREFIX + id);
    const meta = await this.readMeta();
    meta.slots = meta.slots.filter((s) => s.id !== id);
    if (meta.lastOpened === id) delete meta.lastOpened;
    await this.storage.save(META_KEY, JSON.stringify(meta));
  }

  async duplicateSlot(id: string): Promise<string | null> {
    const raw = await this.storage.load(SLOT_PREFIX + id);
    if (!raw) return null;
    const save = migrateSave(JSON.parse(raw));
    const newId = nanoid(10);
    const copy: SaveCurrent = {
      ...save,
      id: newId,
      name: `${save.name} (copy)`,
      updatedAt: Date.now(),
    };
    await this.storage.save(SLOT_PREFIX + newId, JSON.stringify(copy));
    await this.updateMeta({
      id: newId,
      name: copy.name,
      updatedAt: copy.updatedAt,
      population: 0,
    });
    return newId;
  }

  private async readMeta(): Promise<MetaIndex> {
    const raw = await this.storage.load(META_KEY);
    if (!raw) return { slots: [] };
    try {
      const parsed = JSON.parse(raw) as MetaIndex;
      return { slots: parsed.slots ?? [], lastOpened: parsed.lastOpened };
    } catch {
      return { slots: [] };
    }
  }

  private async updateMeta(slot: SlotMeta): Promise<void> {
    const meta = await this.readMeta();
    const existing = meta.slots.findIndex((s) => s.id === slot.id);
    if (existing >= 0) meta.slots[existing] = slot;
    else meta.slots.push(slot);
    await this.storage.save(META_KEY, JSON.stringify(meta));
  }
}

function CURRENT_VERSION(): number {
  return 1;
}
