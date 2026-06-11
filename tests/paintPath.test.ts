import { describe, expect, it } from "vitest";
import { City } from "../src/core/model/city";
import { tileLineConnected, tileLinePathL } from "../src/core/model/grid";
import { paintRoadPath, paintRoadStroke } from "../src/core/actions/paintRoad";
import { createLine, paintLinePath } from "../src/core/actions/paintLine";
import { placeBuilding } from "../src/core/actions/placeBuilding";
import { placeRoadTile } from "../src/core/actions/paintRoad";
import { getItem } from "../src/core/catalog/items";
import { BIT_S, BIT_W } from "../src/core/roads/autotile";

describe("path painting (Grid Lock commit)", () => {
  it("an L path produces a proper corner mask at the elbow", () => {
    const city = new City("T", 32, 32);
    paintRoadPath(city, tileLinePathL(2, 2, 6, 5)); // x-run to (6,2), then down
    // Elbow at (6,2): connected W and S.
    expect(city.roadMask[city.index(6, 2)]).toBe(BIT_S | BIT_W);
  });

  it("stroke is equivalent to path over tileLineConnected", () => {
    const a = new City("T", 32, 32);
    const b = new City("T", 32, 32);
    paintRoadStroke(a, 3, 3, 11, 8);
    paintRoadPath(b, tileLineConnected(3, 3, 11, 8));
    expect(a.road).toEqual(b.road);
    expect(a.roadMask).toEqual(b.roadMask);
  });

  it("paintLinePath notifies exactly once", () => {
    const city = new City("T", 32, 32);
    const line = createLine(city, "rail", "Red", 0)!;
    let notifications = 0;
    city.onChanged(() => notifications++);
    paintLinePath(city, "rail", tileLinePathL(2, 2, 10, 6), line.id);
    expect(notifications).toBe(1);
  });

  it("rail path skips tiles blocked by buildings", () => {
    const city = new City("T", 32, 32);
    placeRoadTile(city, 4, 6);
    placeBuilding(city, getItem("park")!, 5, 5, 0);
    const line = createLine(city, "rail", "Red", 0)!;
    paintLinePath(city, "rail", tileLinePathL(3, 5, 8, 5), line.id);
    expect(city.rail[city.index(5, 5)]).toBe(0); // blocked by the park
    expect(city.rail[city.index(4, 5)]).toBe(line.id);
    expect(city.rail[city.index(6, 5)]).toBe(line.id);
  });
});
