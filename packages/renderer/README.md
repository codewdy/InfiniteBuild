# @infinite-build/renderer

PixiJS battle presentation for InfiniteBuild. The package consumes core `BattleLog` snapshots and owns the battlefield canvas, character poses, effects, damage text, camera interpolation. It does not execute battles or manage player state.

```ts
import { Battlefield } from "@infinite-build/renderer";

const battlefield = await Battlefield.create(canvas, {
  vision: { x: 20, y: 8 },
});
battlefield.update({
  log,
  background: "grassland",
  frameDuration: 200,
  playing: true,
});
// On a new battle:
battlefield.reset();
// When the view is removed:
battlefield.destroy();
```

Build with `pnpm --filter @infinite-build/renderer build`, or use the workspace build.
The package exports TypeScript declarations and compiled code in `dist/`.

Shared artwork, manifests, cropped textures and loading are managed by
[`@infinite-build/assets`](../assets/README.md). The renderer owns display objects
and retains shared textures across scene resets. Serve the assets package's
`dist/` and `runtime/` directories together. Browser consumers must bundle dependencies
or provide import-map entries for `@infinite-build/assets` and `pixi.js`.
