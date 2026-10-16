import { Container, Rectangle, Sprite, type Renderer } from "pixi.js";

/** Owns the temporary snapshot texture used between battles. */
export class BattleTransition extends Container {
  private transition?: { snapshot: Sprite; startedAt: number };
  constructor(private readonly scene: Container) {
    super();
  }
  get active(): boolean {
    return this.transition !== undefined;
  }
  capture(renderer: Renderer, width: number, height: number): void {
    const snapshot = new Sprite(
      renderer.generateTexture({
        target: this.scene,
        frame: new Rectangle(0, 0, width, height),
        resolution: renderer.resolution,
      }),
    );
    this.addChild(snapshot);
    this.transition = { snapshot, startedAt: performance.now() };
    this.scene.alpha = 0;
  }
  reset(): void {
    if (this.transition) {
      const texture = this.transition.snapshot.texture;
      this.transition.snapshot.destroy();
      texture.destroy(true);
      this.transition = undefined;
    }
    this.scene.alpha = 1;
  }

  draw(now: number, width: number, height: number): void {
    if (!this.transition) return;
    const progress = Math.min(
      1,
      Math.max(0, (now - this.transition.startedAt) / 500),
    );
    if (progress >= 1) {
      this.reset();
      return;
    }
    const fadeOut = Math.min(1, progress * 2);
    const fadeIn = Math.max(0, progress * 2 - 1);
    const smooth = (value: number) => value * value * (3 - 2 * value);
    this.transition.snapshot.alpha = 1 - smooth(fadeOut);
    this.transition.snapshot.width = width;
    this.transition.snapshot.height = height;
    this.scene.alpha = smooth(fadeIn);
  }
}
