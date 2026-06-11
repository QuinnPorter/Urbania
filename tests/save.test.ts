import { describe, expect, it } from "vitest";
import { City } from "../src/core/model/city";
import { getItem } from "../src/core/catalog/items";
import { placeBuilding } from "../src/core/actions/placeBuilding";
import { placeRoadTile } from "../src/core/actions/paintRoad";
import { paintZoneTile } from "../src/core/actions/paintZone";
import {
  createNeighbourhood,
  paintNeighbourhoodStroke,
} from "../src/core/actions/paintNeighbourhood";
import { createLine, paintLineStroke } from "../src/core/actions/paintLine";
import {
  decodeRLE,
  deserializeCity,
  encodeRLE,
  serializeCity,
} from "../src/core/save/serialize";
import { migrateSave, NewerSaveError } from "../src/core/save/migrate";
import {
  decodeShareCode,
  encodeShareCode,
} from "../src/core/save/sharecode";
import { ZONE_COMMERCIAL, ZONE_RESIDENTIAL } from "../src/core/model/types";

function buildSampleCity(): City {
  const city = new City("Quinnville", 32, 32);
  for (let x = 4; x < 20; x++) placeRoadTile(city, x, 10);
  for (let y = 5; y < 15; y++) placeRoadTile(city, 12, y);
  paintZoneTile(city, 5, 11, ZONE_RESIDENTIAL);
  paintZoneTile(city, 6, 11, ZONE_RESIDENTIAL);
  paintZoneTile(city, 7, 11, ZONE_COMMERCIAL);
  placeBuilding(city, getItem("school")!, 5, 8, 0);
  placeBuilding(city, getItem("train-station")!, 14, 11, 1); // rotated
  placeBuilding(city, getItem("park")!, 9, 12, 0);
  const id = createNeighbourhood(city, "Old Town", 200)!;
  paintNeighbourhoodStroke(city, 5, 9, 8, 12, id);
  const red = createLine(city, "rail", "Red Line", 0)!;
  paintLineStroke(city, "rail", 4, 18, 20, 18, red.id);
  const blue = createLine(city, "subway", "Blue Line", 220)!;
  paintLineStroke(city, "subway", 10, 22, 10, 6, blue.id);
  return city;
}

describe("RLE", () => {
  it("round-trips arbitrary data", () => {
    const data = new Uint8Array([0, 0, 0, 1, 1, 2, 0, 0, 255, 255, 3]);
    expect(decodeRLE(encodeRLE(data), data.length)).toEqual(data);
  });

  it("rejects corrupt input", () => {
    expect(() => decodeRLE("0:5,1:999", 10)).toThrow();
    expect(() => decodeRLE("0:4", 10)).toThrow(); // too short
  });
});

describe("save round-trip", () => {
  it("preserves the city through serialize → deserialize", () => {
    const city = buildSampleCity();
    const save = serializeCity(city, "test-id", 1000, 2000);
    const restored = deserializeCity(save);

    expect(restored.name).toBe("Quinnville");
    expect(restored.road).toEqual(city.road);
    expect(restored.roadMask).toEqual(city.roadMask);
    expect(restored.zone).toEqual(city.zone);
    expect(restored.neighbourhood).toEqual(city.neighbourhood);
    expect(restored.neighbourhoods.get(1)?.name).toBe("Old Town");
    const liveBuildings = restored.buildings.filter(Boolean);
    expect(liveBuildings).toHaveLength(3);
    expect(restored.occupant).toEqual(city.occupant);
    // Rail/subway lines + their masks round-trip.
    expect(restored.rail).toEqual(city.rail);
    expect(restored.subway).toEqual(city.subway);
    expect(restored.railMask).toEqual(city.railMask);
    expect(restored.subwayMask).toEqual(city.subwayMask);
    expect(restored.railLines.get(1)?.name).toBe("Red Line");
    expect(restored.subwayLines.get(1)?.name).toBe("Blue Line");
  });

  it("migrates a v1 save to v2 with empty rail/subway", () => {
    const city = buildSampleCity();
    const v2 = serializeCity(city, "id", 1000, 2000);
    // Synthesize a legacy v1 save by stripping the v2-only fields.
    const v1: Record<string, unknown> = { ...v2, v: 1 };
    delete v1.rail;
    delete v1.subway;
    delete v1.railLines;
    delete v1.subwayLines;

    const migrated = migrateSave(v1);
    expect(migrated.v).toBe(2);
    expect(migrated.rail).toBe("");
    expect(migrated.subway).toBe("");
    expect(migrated.railLines).toEqual([]);
    // A migrated save deserializes cleanly with no rail/subway tiles.
    const restored = deserializeCity(migrated);
    expect(restored.railLines.size).toBe(0);
    restored.rail.forEach((v) => expect(v).toBe(0));
  });

  it("drops unknown items instead of crashing", () => {
    const city = buildSampleCity();
    const save = serializeCity(city, "test-id", 1000, 2000);
    save.buildings.push(["future-fusion-plant", 2, 2, 0]);
    const restored = deserializeCity(save);
    expect(restored.buildings.filter(Boolean)).toHaveLength(3);
  });

  it("migration passes current saves through and rejects newer ones", () => {
    const city = buildSampleCity();
    const save = serializeCity(city, "test-id", 1000, 2000);
    expect(migrateSave(save)).toBe(save);
    expect(() => migrateSave({ ...save, v: 99 })).toThrow(NewerSaveError);
    expect(() => migrateSave("garbage")).toThrow();
  });
});

describe("share codes", () => {
  it("round-trips a city", () => {
    const city = buildSampleCity();
    const code = encodeShareCode(city);
    expect(code.startsWith("URB1.")).toBe(true);

    const restored = decodeShareCode(code);
    expect(restored.name).toBe("Quinnville");
    expect(restored.road).toEqual(city.road);
    expect(restored.zone).toEqual(city.zone);
    expect(restored.neighbourhood).toEqual(city.neighbourhood);
    expect(restored.buildings.filter(Boolean)).toHaveLength(3);
    expect(restored.roadMask).toEqual(city.roadMask);
    // Lines survive the binary round-trip.
    expect(restored.rail).toEqual(city.rail);
    expect(restored.subway).toEqual(city.subway);
    expect(restored.railLines.get(1)?.name).toBe("Red Line");
    expect(restored.subwayLines.get(1)?.name).toBe("Blue Line");
  });

  it("stays compact for a busy 64x64 city", () => {
    const city = new City("Big", 64, 64);
    for (let y = 4; y < 60; y += 4) {
      for (let x = 2; x < 62; x++) placeRoadTile(city, x, y);
    }
    for (let y = 5; y < 59; y++) {
      for (let x = 2; x < 62; x++) {
        if (city.road[city.index(x, y)] === 0 && (x + y) % 3 !== 0) {
          paintZoneTile(city, x, y, ZONE_RESIDENTIAL);
        }
      }
    }
    const code = encodeShareCode(city);
    expect(code.length).toBeLessThan(3000);
  });

  it("rejects garbage with friendly errors", () => {
    expect(() => decodeShareCode("not-a-code")).toThrow(/URB1/);
    expect(() => decodeShareCode("URB1.!!!@@@")).toThrow(/damaged|incomplete/);
    expect(() => decodeShareCode("URB1.AAAA")).toThrow();
    // Truncated valid code:
    const code = encodeShareCode(buildSampleCity());
    expect(() => decodeShareCode(code.slice(0, 20))).toThrow();
  });
});
