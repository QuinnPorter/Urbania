import { describe, expect, it } from "vitest";
import { City } from "../src/core/model/city";
import {
  paintZoneBrushStroke,
  paintZoneRect,
  paintZoneStroke,
} from "../src/core/actions/paintZone";
import { placeRoadTile } from "../src/core/actions/paintRoad";
import { ZONE_RESIDENTIAL } from "../src/core/model/types";

function zoneCount(city: City): number {
  let n = 0;
  city.zone.forEach((v) => (n += v > 0 ? 1 : 0));
  return n;
}

describe("zone rect fill", () => {
  it("fills a normalized rectangle from any corner pair", () => {
    const city = new City("T", 32, 32);
    paintZoneRect(city, 10, 8, 5, 4, ZONE_RESIDENTIAL); // inverted corners
    expect(zoneCount(city)).toBe(6 * 5);
    expect(city.zone[city.index(5, 4)]).toBe(ZONE_RESIDENTIAL);
    expect(city.zone[city.index(10, 8)]).toBe(ZONE_RESIDENTIAL);
  });

  it("clamps to city bounds", () => {
    const city = new City("T", 16, 16);
    paintZoneRect(city, -5, -5, 2, 2, ZONE_RESIDENTIAL);
    expect(zoneCount(city)).toBe(3 * 3);
    expect(paintZoneRect(city, -10, -10, -2, -2, ZONE_RESIDENTIAL)).toBe(false);
  });

  it("skips roads inside the rect", () => {
    const city = new City("T", 32, 32);
    placeRoadTile(city, 6, 6);
    paintZoneRect(city, 5, 5, 7, 7, ZONE_RESIDENTIAL);
    expect(city.zone[city.index(6, 6)]).toBe(0);
    expect(zoneCount(city)).toBe(8);
  });

  it("notifies exactly once", () => {
    const city = new City("T", 32, 32);
    let notifications = 0;
    city.onChanged(() => notifications++);
    paintZoneRect(city, 2, 2, 9, 9, ZONE_RESIDENTIAL);
    expect(notifications).toBe(1);
  });
});

describe("zone brush sizes", () => {
  it("3×3 brush stamps a centred square per tile", () => {
    const city = new City("T", 32, 32);
    paintZoneBrushStroke(city, 10, 10, 10, 10, ZONE_RESIDENTIAL, 3);
    expect(zoneCount(city)).toBe(9);
    expect(city.zone[city.index(9, 9)]).toBe(ZONE_RESIDENTIAL);
    expect(city.zone[city.index(11, 11)]).toBe(ZONE_RESIDENTIAL);
    expect(city.zone[city.index(12, 12)]).toBe(0);
  });

  it("5×5 brush along a stroke leaves no gaps", () => {
    const city = new City("T", 64, 64);
    paintZoneBrushStroke(city, 10, 10, 20, 10, ZONE_RESIDENTIAL, 5);
    // Strip from (8..22, 8..12) fully zoned.
    for (let y = 8; y <= 12; y++) {
      for (let x = 8; x <= 22; x++) {
        expect(city.zone[city.index(x, y)]).toBe(ZONE_RESIDENTIAL);
      }
    }
  });

  it("size 1 is identical to the classic stroke", () => {
    const a = new City("T", 32, 32);
    const b = new City("T", 32, 32);
    paintZoneBrushStroke(a, 3, 3, 12, 7, ZONE_RESIDENTIAL, 1);
    paintZoneStroke(b, 3, 3, 12, 7, ZONE_RESIDENTIAL);
    expect(a.zone).toEqual(b.zone);
  });
});
