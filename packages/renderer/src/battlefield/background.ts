import { Container, Sprite, type Texture } from "pixi.js";
export class BattlefieldBackground extends Container {
  private readonly tiles: Sprite[] = [];
  constructor() {
    super();
    // Two tiles cover any viewport because each tile is at least viewport-wide.
    for (let index = 0; index < 2; index++) {
      const tile = new Sprite({ roundPixels: true });
      this.tiles.push(tile);
      this.addChild(tile);
    }
  }
  setTexture(texture: Texture): void {
    for (const tile of this.tiles) tile.texture = texture;
  }
  draw(
    origin: number,
    width: number,
    height: number,
    pixelsPerUnit: number,
  ): void {
    const texture = this.tiles[0]!.texture;
    const tileWidth = Math.ceil(
      Math.max(width, (height * texture.orig.width) / texture.orig.height),
    );
    const scale = tileWidth / texture.orig.width;
    // Follow the same interpolated camera as the actors, never elapsed wall time.
    const offset = origin * pixelsPerUnit + (tileWidth - width) / 2;
    const firstTile = Math.floor(offset / tileWidth);
    const phase = offset - firstTile * tileWidth;
    for (const [index, tile] of this.tiles.entries()) {
      const mirrored = (firstTile + index) % 2 !== 0;
      // Alternating direction makes neighboring edges identical without editing the PNG.
      tile.anchor.set(mirrored ? 1 : 0, 1);
      tile.scale.set(mirrored ? -scale : scale, scale);
      const bottom =
        height + Math.max(0, texture.orig.height * scale - height) / 2;
      tile.position.set(
        Math.round(index * tileWidth - phase),
        Math.round(bottom),
      );
    }
  }
}
