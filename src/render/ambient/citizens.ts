import { Container, Sprite } from "pixi.js";
import type { City } from "../../core/model/city";
import { getItem } from "../../core/catalog/items";
import { rotatedFootprint } from "../../core/actions/placeBuilding";
import { ZONE_RESIDENTIAL } from "../../core/model/types";
import { TILE, type TextureAtlas } from "../textureFactory";

interface Citizen {
  sprite: Sprite;
  homeX: number; // wander anchor (world px)
  homeY: number;
  angle: number;
  phase: number;
}

const MAX_CITIZENS = 40;
const WANDER_RADIUS = TILE * 0.8;

/** Tiny wanderers in parks, plazas, and residential blocks. */
export class CitizenSystem {
  private citizens: Citizen[] = [];
  private layer: Container;
  private atlas: TextureAtlas;
  private city: City;
  private elapsed = 0;

  constructor(layer: Container, atlas: TextureAtlas, city: City) {
    this.layer = layer;
    this.atlas = atlas;
    this.city = city;
  }

  setCity(city: City): void {
    this.city = city;
    this.respawn();
  }

  /** Re-anchor citizens to current parks/plazas/residential (on cityChanged). */
  respawn(maxCitizens = MAX_CITIZENS): void {
    for (const c of this.citizens) c.sprite.destroy();
    this.citizens = [];

    const anchors: Array<[number, number]> = [];
    for (const building of this.city.buildings) {
      if (!building) continue;
      const def = getItem(building.defId);
      if (!def) continue;
      if (def.id === "park" || def.id === "big-park" || def.id === "plaza") {
        const fp = rotatedFootprint(def, building.rot);
        anchors.push([
          (building.x + fp.w / 2) * TILE,
          (building.y + fp.h / 2) * TILE,
        ]);
      }
    }
    const { zone, width } = this.city;
    for (let i = 0; i < zone.length && anchors.length < 200; i += 7) {
      if (zone[i] === ZONE_RESIDENTIAL) {
        anchors.push([
          ((i % width) + 0.5) * TILE,
          (Math.floor(i / width) + 0.5) * TILE,
        ]);
      }
    }
    if (anchors.length === 0) return;

    const count = Math.min(maxCitizens, anchors.length * 2);
    for (let i = 0; i < count; i++) {
      const [ax, ay] = anchors[Math.floor(Math.random() * anchors.length)]!;
      const sprite = new Sprite(this.atlas.citizen);
      sprite.anchor.set(0.5);
      this.layer.addChild(sprite);
      this.citizens.push({
        sprite,
        homeX: ax,
        homeY: ay,
        angle: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(dtSeconds: number): void {
    this.elapsed += dtSeconds;
    for (const c of this.citizens) {
      c.angle += (Math.sin(this.elapsed * 0.7 + c.phase) * 0.8) * dtSeconds;
      const r = WANDER_RADIUS * (0.5 + 0.5 * Math.sin(this.elapsed * 0.3 + c.phase));
      c.sprite.position.set(
        c.homeX + Math.cos(c.angle) * r,
        c.homeY + Math.sin(c.angle) * r + Math.sin(this.elapsed * 4 + c.phase) * 1.2,
      );
    }
  }
}
