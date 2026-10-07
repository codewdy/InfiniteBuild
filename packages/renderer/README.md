# @infinite-build/renderer

PixiJS battle presentation for InfiniteBuild. The package consumes core `BattleLog` snapshots and owns the battlefield canvas, character poses, effects, damage text, camera interpolation and pixel atlas. It does not execute battles or manage player state.

```ts
import { Battlefield } from "@infinite-build/renderer";

const battlefield = await Battlefield.create(canvas);
battlefield.update(log, {
  vision: 20,
  frameDuration: 200,
  playing: true,
});
// On a new battle:
battlefield.reset();
// When the view is removed:
battlefield.destroy();
```

Build with `pnpm --filter @infinite-build/renderer build`, or use the workspace build. The package exports TypeScript declarations and ships `assets/` alongside `dist/`. Serve both directories while preserving their relative paths: the atlas loader resolves `../assets/pixel-battle/` relative to its module URL. The mock-app serves the package under `/renderer/` and watches its sources and assets for changes.

The generated atlas, frame definitions and generation prompt live in `assets/pixel-battle/`. PixiJS is a renderer dependency; browser consumers must bundle it or provide an import-map entry. The mock-app uses its locally installed standalone browser module.
