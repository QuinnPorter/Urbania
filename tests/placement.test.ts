import { describe, expect, it } from "vitest";
import { City } from "../src/core/model/city";
import { getItem } from "../src/core/catalog/items";
import {
  placeBuilding,
  rotatedFootprint,
  validatePlacement,
} from "../src/core/actions/placeBuilding";
import { placeRoadTile } from "../src/core/actions/paintRoad";
import { paintZoneTile } from "../src/core/actions/paintZone";
import { bulldozeTile } from "../src/core/actions/bulldoze";
import { NO_OCCUPANT, ZONE_RESIDENTIAL } from "../src/core/model/types";

const university = getItem("university")!; // 3x3, requires road
const park = getItem("park")!; // 1x1, no road needed
const trainStation = getItem("train-station")!; // 3x2 rotatable

describe("placement validation", () => {
  it("rejects out-of-bounds footprints", () => {
    const city = new City("T", 16, 16);
    expect(validatePlacement(city, university, 14, 14, 0)).toBe(
      "out-of-bounds",
    );
    expect(validatePlacement(city, university, -1, 0, 0)).toBe("out-of-bounds");
  });

  it("requires road adjacency for the university", () => {
    const city = new City("T", 16, 16);
    expect(validatePlacement(city, university, 5, 5, 0)).toBe("needs-road");
    placeRoadTile(city, 4, 5); // touches west edge of 3x3 at (5,5)
    expect(validatePlacement(city, university, 5, 5, 0)).toBeNull();
  });

  it("parks don't need roads", () => {
    const city = new City("T", 16, 16);
    expect(validatePlacement(city, park, 5, 5, 0)).toBeNull();
  });

  it("rejects overlap with buildings and roads", () => {
    const city = new City("T", 16, 16);
    placeBuilding(city, park, 5, 5, 0);
    expect(validatePlacement(city, park, 5, 5, 0)).toBe("occupied");
    placeRoadTile(city, 7, 7);
    expect(validatePlacement(city, park, 7, 7, 0)).toBe("occupied");
  });

  it("rotation swaps the footprint", () => {
    expect(rotatedFootprint(trainStation, 0)).toEqual({ w: 3, h: 2 });
    expect(rotatedFootprint(trainStation, 1)).toEqual({ w: 2, h: 3 });
  });

  it("building clears zone paint underneath", () => {
    const city = new City("T", 16, 16);
    paintZoneTile(city, 5, 5, ZONE_RESIDENTIAL);
    placeBuilding(city, park, 5, 5, 0);
    expect(city.zone[city.index(5, 5)]).toBe(0);
  });

  it("a building cannot be placed on a rail tile, but can over a subway", () => {
    const city = new City("T", 16, 16);
    // Rail blocks (surface tracks).
    city.rail[city.index(5, 5)] = 1;
    expect(validatePlacement(city, park, 5, 5, 0)).toBe("occupied");
    // Subway is underground — placement ignores it.
    const clean = new City("T", 16, 16);
    clean.subway[clean.index(5, 5)] = 1;
    expect(validatePlacement(clean, park, 5, 5, 0)).toBeNull();
  });

  it("bulldozing any footprint tile removes the whole building", () => {
    const city = new City("T", 16, 16);
    placeRoadTile(city, 4, 5);
    const result = placeBuilding(city, university, 5, 5, 0);
    expect(typeof result).toBe("number");
    bulldozeTile(city, 7, 7); // far corner of the 3x3
    for (let y = 5; y < 8; y++) {
      for (let x = 5; x < 8; x++) {
        expect(city.occupant[city.index(x, y)]).toBe(NO_OCCUPANT);
      }
    }
    expect(city.buildings[result as number]).toBeNull();
  });
});
