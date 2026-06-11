import { describe, expect, it } from "vitest";
import { City } from "../src/core/model/city";
import {
  createLine,
  dissolveLine,
  paintLineStroke,
  renameLine,
} from "../src/core/actions/paintLine";
import { placeRoadTile } from "../src/core/actions/paintRoad";
import { bulldozeTile } from "../src/core/actions/bulldoze";
import { BIT_E, BIT_W } from "../src/core/roads/autotile";

describe("transit lines", () => {
  it("creates named lines in independent rail/subway namespaces", () => {
    const city = new City("T", 32, 32);
    const rail = createLine(city, "rail", "Red Line", 0)!;
    const sub = createLine(city, "subway", "Blue Line", 220)!;
    expect(rail.id).toBe(1);
    expect(sub.id).toBe(1); // independent namespace
    expect(city.railLines.get(1)?.name).toBe("Red Line");
    expect(city.subwayLines.get(1)?.name).toBe("Blue Line");
  });

  it("paints a connected line that auto-tiles", () => {
    const city = new City("T", 32, 32);
    const line = createLine(city, "rail", "Red", 0)!;
    paintLineStroke(city, "rail", 4, 5, 8, 5, line.id);
    expect(city.rail[city.index(5, 5)]).toBe(line.id);
    expect(city.railMask[city.index(5, 5)]).toBe(BIT_E | BIT_W); // straight
    expect(city.railMask[city.index(4, 5)]).toBe(BIT_E); // dead-end stub
  });

  it("painting a second line over the first overwrites (last wins)", () => {
    const city = new City("T", 32, 32);
    const a = createLine(city, "rail", "A", 0)!;
    const b = createLine(city, "rail", "B", 120)!;
    paintLineStroke(city, "rail", 4, 5, 8, 5, a.id);
    paintLineStroke(city, "rail", 6, 3, 6, 7, b.id); // crosses at (6,5)
    expect(city.rail[city.index(6, 5)]).toBe(b.id);
    // Still connected (presence-based): the crossing is a 4-way junction.
    expect(city.railMask[city.index(6, 5)]).toBe(0b1111);
  });

  it("renames and dissolves a line, clearing its tiles", () => {
    const city = new City("T", 32, 32);
    const line = createLine(city, "subway", "Old", 200)!;
    paintLineStroke(city, "subway", 2, 2, 6, 2, line.id);
    expect(renameLine(city, "subway", line.id, "New")).toBe(true);
    expect(city.subwayLines.get(line.id)?.name).toBe("New");

    expect(dissolveLine(city, "subway", line.id)).toBe(true);
    expect(city.subwayLines.has(line.id)).toBe(false);
    let remaining = 0;
    city.subway.forEach((v) => (remaining += v));
    expect(remaining).toBe(0);
  });

  it("rail and road coexist on a level crossing; bulldoze removes road first", () => {
    const city = new City("T", 32, 32);
    const line = createLine(city, "rail", "Cross", 0)!;
    placeRoadTile(city, 5, 5);
    paintLineStroke(city, "rail", 5, 5, 5, 5, line.id);
    // Both present on the same tile.
    expect(city.road[city.index(5, 5)]).toBe(1);
    expect(city.rail[city.index(5, 5)]).toBe(line.id);

    bulldozeTile(city, 5, 5);
    expect(city.road[city.index(5, 5)]).toBe(0);
    expect(city.rail[city.index(5, 5)]).toBe(line.id); // rail survives
    bulldozeTile(city, 5, 5);
    expect(city.rail[city.index(5, 5)]).toBe(0); // second pass clears rail
  });
});
