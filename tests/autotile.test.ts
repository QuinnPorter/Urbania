import { describe, expect, it } from "vitest";
import { City } from "../src/core/model/city";
import { placeRoadTile } from "../src/core/actions/paintRoad";
import { bulldozeTile } from "../src/core/actions/bulldoze";
import {
  BIT_E,
  BIT_N,
  BIT_S,
  BIT_W,
  computeRoadMask,
} from "../src/core/roads/autotile";
import { recomputeAllMasks } from "../src/core/model/network";

function cityWithRoads(roads: Array<[number, number]>): City {
  const city = new City("Test", 16, 16);
  for (const [x, y] of roads) placeRoadTile(city, x, y);
  return city;
}

describe("road autotile", () => {
  it("isolated road has mask 0", () => {
    const city = cityWithRoads([[5, 5]]);
    expect(city.roadMask[city.index(5, 5)]).toBe(0);
  });

  it("straight horizontal road gets E+W mask in the middle", () => {
    const city = cityWithRoads([
      [4, 5],
      [5, 5],
      [6, 5],
    ]);
    expect(city.roadMask[city.index(5, 5)]).toBe(BIT_E | BIT_W);
    expect(city.roadMask[city.index(4, 5)]).toBe(BIT_E); // dead-end stub
    expect(city.roadMask[city.index(6, 5)]).toBe(BIT_W);
  });

  it("crossroads gets full mask 15", () => {
    const city = cityWithRoads([
      [5, 5],
      [5, 4],
      [6, 5],
      [5, 6],
      [4, 5],
    ]);
    expect(city.roadMask[city.index(5, 5)]).toBe(
      BIT_N | BIT_E | BIT_S | BIT_W,
    );
  });

  it("T-junction gets three bits", () => {
    const city = cityWithRoads([
      [5, 5],
      [4, 5],
      [6, 5],
      [5, 6],
    ]);
    expect(city.roadMask[city.index(5, 5)]).toBe(BIT_E | BIT_S | BIT_W);
  });

  it("map edge counts as unconnected", () => {
    const city = cityWithRoads([[0, 0]]);
    expect(computeRoadMask(city, 0, 0)).toBe(0);
  });

  it("bulldozing a road updates neighbour masks", () => {
    const city = cityWithRoads([
      [4, 5],
      [5, 5],
      [6, 5],
    ]);
    bulldozeTile(city, 5, 5);
    expect(city.road[city.index(5, 5)]).toBe(0);
    expect(city.roadMask[city.index(4, 5)]).toBe(0);
    expect(city.roadMask[city.index(6, 5)]).toBe(0);
  });
});

describe("generic network masks (presence-based, value-aware)", () => {
  it("two different line ids still connect (presence, like roads cross)", () => {
    // A generic layer where one arm is line 1 and the other is line 2; the
    // shared centre should see all four neighbours present → mask 15.
    const city = new City("T", 16, 16);
    const cells = city.rail;
    const mask = city.railMask;
    // Vertical arm = line 1, horizontal arm = line 2, centre = line 2.
    for (const [x, y, v] of [
      [5, 4, 1],
      [5, 6, 1],
      [4, 5, 2],
      [6, 5, 2],
      [5, 5, 2],
    ] as Array<[number, number, number]>) {
      cells[city.index(x, y)] = v;
    }
    recomputeAllMasks(city, cells, mask);
    expect(mask[city.index(5, 5)]).toBe(
      BIT_N | BIT_E | BIT_S | BIT_W,
    );
  });

  it("an empty cell always has mask 0", () => {
    const city = new City("T", 16, 16);
    city.rail[city.index(5, 5)] = 1;
    recomputeAllMasks(city, city.rail, city.railMask);
    expect(city.railMask[city.index(6, 6)]).toBe(0); // blank, no spurious mask
  });
});
