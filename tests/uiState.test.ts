import { describe, expect, it } from "vitest";
import {
  activeLineId,
  activeLineKind,
  activeTool,
  selectItem,
  selectTool,
  useLine,
} from "../src/state/uiState";

describe("uiState line selection", () => {
  it("selectItem clears the active line (the lingering-chip bug)", () => {
    useLine("subway", 3);
    expect(activeLineKind.value).toBe("subway");
    expect(activeLineId.value).toBe(3);

    selectItem("road", "infrastructure");
    expect(activeLineKind.value).toBeNull();
    expect(activeLineId.value).toBeNull();
    expect(activeTool.value).toBe("item");
  });

  it("selectTool clears the active line", () => {
    useLine("rail", 1);
    selectTool("inspect");
    expect(activeLineKind.value).toBeNull();
    expect(activeLineId.value).toBeNull();
  });

  it("useLine activates the matching tray item", () => {
    useLine("rail", 2);
    expect(activeLineKind.value).toBe("rail");
    expect(activeLineId.value).toBe(2);
    expect(activeTool.value).toBe("item");
  });
});
