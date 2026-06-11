import { Container, Sprite } from "pixi.js";
import type { City } from "../../core/model/city";
import { BIT_E, BIT_N, BIT_S, BIT_W } from "../../core/roads/autotile";
import { TILE, type TextureAtlas } from "../textureFactory";

interface Car {
  sprite: Sprite;
  x: number; // current tile
  y: number;
  nx: number; // next tile
  ny: number;
  t: number; // 0..1 progress along segment
  speed: number; // tiles per second
  tint: number;
}

const CAR_TINTS = [0xff8a80, 0x80d8ff, 0xffd180, 0xa5d6a7, 0xe1bee7, 0xfff59d];
const MAX_CARS = 50;

/** Decorative road-graph random walkers. Despawn silently if stranded. */
export class CarSystem {
  private cars: Car[] = [];
  private layer: Container;
  private atlas: TextureAtlas;
  private city: City;
  private targetCount = 0;

  constructor(layer: Container, atlas: TextureAtlas, city: City) {
    this.layer = layer;
    this.atlas = atlas;
    this.city = city;
  }

  setCity(city: City): void {
    this.city = city;
    for (const car of this.cars) car.sprite.destroy();
    this.cars = [];
  }

  /** Recount roads (cheap; call on cityChanged). */
  refreshTarget(maxCars = MAX_CARS): void {
    let roads = 0;
    for (let i = 0; i < this.city.road.length; i++) {
      if (this.city.road[i] === 1) roads++;
    }
    this.targetCount = Math.min(maxCars, Math.floor(roads / 10));
  }

  update(dtSeconds: number): void {
    // Spawn/despawn toward target.
    while (this.cars.length < this.targetCount) {
      const spawned = this.spawn();
      if (!spawned) break;
    }
    while (this.cars.length > this.targetCount) {
      this.cars.pop()!.sprite.destroy();
    }

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i]!;
      // Stranded? (road bulldozed under it)
      if (!this.city.hasRoad(car.nx, car.ny) || !this.city.hasRoad(car.x, car.y)) {
        car.sprite.destroy();
        this.cars.splice(i, 1);
        continue;
      }
      car.t += car.speed * dtSeconds;
      while (car.t >= 1) {
        car.t -= 1;
        const next = this.pickNext(car);
        if (!next) {
          car.sprite.destroy();
          this.cars.splice(i, 1);
          break;
        }
        car.x = car.nx;
        car.y = car.ny;
        car.nx = next[0];
        car.ny = next[1];
      }
      if (!this.cars.includes(car)) continue;

      const px = (car.x + (car.nx - car.x) * car.t + 0.5) * TILE;
      const py = (car.y + (car.ny - car.y) * car.t + 0.5) * TILE;
      // Offset to the right-hand side of travel direction (cute, readable).
      const dirX = Math.sign(car.nx - car.x);
      const dirY = Math.sign(car.ny - car.y);
      const offset = TILE * 0.14;
      car.sprite.position.set(px + dirY * -offset, py + dirX * offset);
      const targetRot = Math.atan2(dirY, dirX);
      car.sprite.rotation = lerpAngle(car.sprite.rotation, targetRot, 0.35);
    }
  }

  private spawn(): boolean {
    const { road, width } = this.city;
    // Random scan from a random offset — fine for decoration.
    const start = Math.floor(Math.random() * road.length);
    for (let probe = 0; probe < road.length; probe++) {
      const idx = (start + probe) % road.length;
      if (road[idx] !== 1) continue;
      const x = idx % width;
      const y = Math.floor(idx / width);
      const next = this.neighbours(x, y);
      if (next.length === 0) continue;
      const [nx, ny] = next[Math.floor(Math.random() * next.length)]!;
      const sprite = new Sprite(this.atlas.car);
      sprite.anchor.set(0.5);
      sprite.tint = CAR_TINTS[Math.floor(Math.random() * CAR_TINTS.length)]!;
      this.layer.addChild(sprite);
      this.cars.push({
        sprite,
        x,
        y,
        nx,
        ny,
        t: Math.random(),
        speed: 1.6 + Math.random() * 0.9,
        tint: sprite.tint as number,
      });
      return true;
    }
    return false;
  }

  private pickNext(car: Car): [number, number] | null {
    const options = this.neighbours(car.nx, car.ny).filter(
      ([x, y]) => !(x === car.x && y === car.y),
    );
    if (options.length > 0) {
      return options[Math.floor(Math.random() * options.length)]!;
    }
    // Dead-end: U-turn if possible.
    return this.city.hasRoad(car.x, car.y) ? [car.x, car.y] : null;
  }

  private neighbours(x: number, y: number): Array<[number, number]> {
    const mask = this.city.roadMask[this.city.index(x, y)]!;
    const result: Array<[number, number]> = [];
    if (mask & BIT_N) result.push([x, y - 1]);
    if (mask & BIT_E) result.push([x + 1, y]);
    if (mask & BIT_S) result.push([x, y + 1]);
    if (mask & BIT_W) result.push([x - 1, y]);
    return result;
  }
}

function lerpAngle(from: number, to: number, k: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * k;
}
