import { describe, expect, it } from "vitest";
import { CATEGORIES, ITEMS, itemsInCategory } from "../src/core/catalog/items";

describe("item catalog sanity", () => {
  it("has unique ids", () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every category has at least one item (except zones tools are zones)", () => {
    for (const cat of CATEGORIES) {
      expect(itemsInCategory(cat.id).length, cat.id).toBeGreaterThan(0);
    }
  });

  it("government category exists with the new civic buildings", () => {
    const gov = itemsInCategory("government").map((i) => i.id);
    expect(gov).toEqual(
      expect.arrayContaining(["city-hall", "courthouse", "parliament", "post-office", "prison"]),
    );
  });

  it("rotatable items have non-square footprints", () => {
    for (const item of ITEMS) {
      if (item.rotatable) {
        expect(item.footprint.w, item.id).not.toBe(item.footprint.h);
      }
    }
  });

  it("coverage radii are positive and footprints valid", () => {
    for (const item of ITEMS) {
      expect(item.footprint.w, item.id).toBeGreaterThan(0);
      expect(item.footprint.h, item.id).toBeGreaterThan(0);
      const cov = item.effects.coverage;
      if (cov) expect(cov.radius, item.id).toBeGreaterThan(0);
    }
  });

  it("every item category references a real category", () => {
    const catIds = new Set(CATEGORIES.map((c) => c.id));
    for (const item of ITEMS) {
      expect(catIds.has(item.category), item.id).toBe(true);
    }
  });
});
