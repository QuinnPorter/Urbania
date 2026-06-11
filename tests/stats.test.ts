import { describe, expect, it } from "vitest";
import { City } from "../src/core/model/city";
import { getItem } from "../src/core/catalog/items";
import { placeBuilding } from "../src/core/actions/placeBuilding";
import { placeRoadTile } from "../src/core/actions/paintRoad";
import { paintZoneTile } from "../src/core/actions/paintZone";
import { computeCoverage } from "../src/core/stats/coverage";
import { computePopulation } from "../src/core/stats/population";
import { computeHappiness } from "../src/core/stats/happiness";
import { createLine, paintLineStroke } from "../src/core/actions/paintLine";
import { ZONE_INDUSTRIAL, ZONE_RESIDENTIAL } from "../src/core/model/types";

describe("stats", () => {
  it("residential near a road yields full population", () => {
    const city = new City("T", 32, 32);
    placeRoadTile(city, 5, 5);
    paintZoneTile(city, 5, 6, ZONE_RESIDENTIAL); // adjacent to road
    const pop = computePopulation(city);
    expect(pop.population).toBe(8);
  });

  it("residential far from roads yields reduced population", () => {
    const city = new City("T", 32, 32);
    paintZoneTile(city, 20, 20, ZONE_RESIDENTIAL);
    const pop = computePopulation(city);
    expect(pop.population).toBe(2); // 8 * 0.25
  });

  it("school coverage reaches residential within radius", () => {
    const city = new City("T", 32, 32);
    placeRoadTile(city, 9, 10);
    placeBuilding(city, getItem("school")!, 10, 10, 0); // r9 from center
    paintZoneTile(city, 15, 10, ZONE_RESIDENTIAL);
    const coverage = computeCoverage(city);
    const hap = computeHappiness(city, coverage);
    expect(hap.coverageShare.education).toBe(1);
  });

  it("industrial next to homes dents happiness vs. without", () => {
    const base = new City("T", 32, 32);
    paintZoneTile(base, 10, 10, ZONE_RESIDENTIAL);
    const baseHap = computeHappiness(base, computeCoverage(base)).happiness;

    const dirty = new City("T", 32, 32);
    paintZoneTile(dirty, 10, 10, ZONE_RESIDENTIAL);
    paintZoneTile(dirty, 11, 10, ZONE_INDUSTRIAL);
    const dirtyHap = computeHappiness(dirty, computeCoverage(dirty)).happiness;
    expect(dirtyHap).toBeLessThan(baseHap);
  });

  it("parks raise happiness for nearby homes", () => {
    const plain = new City("T", 32, 32);
    paintZoneTile(plain, 10, 10, ZONE_RESIDENTIAL);
    const plainHap = computeHappiness(plain, computeCoverage(plain)).happiness;

    const leafy = new City("T", 32, 32);
    paintZoneTile(leafy, 10, 10, ZONE_RESIDENTIAL);
    placeBuilding(leafy, getItem("park")!, 11, 10, 0);
    const leafyHap = computeHappiness(leafy, computeCoverage(leafy)).happiness;
    expect(leafyHap).toBeGreaterThan(plainHap);
  });

  it("a transit line extends transit coverage to nearby homes", () => {
    const city = new City("T", 32, 32);
    paintZoneTile(city, 10, 10, ZONE_RESIDENTIAL);
    const before = computeHappiness(city, computeCoverage(city)).coverageShare
      .transit;
    expect(before).toBe(0);

    const line = createLine(city, "subway", "Blue", 220)!;
    paintLineStroke(city, "subway", 8, 10, 12, 10, line.id); // r3 reaches (10,10)
    const after = computeHappiness(city, computeCoverage(city)).coverageShare
      .transit;
    expect(after).toBe(1);
  });

  it("empty city reads as content", () => {
    const city = new City("T", 16, 16);
    const hap = computeHappiness(city, computeCoverage(city));
    expect(hap.happiness).toBe(72);
  });
});
