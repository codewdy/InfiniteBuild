# @infinite-build/assets

Shared runtime artwork and Pixi textures for the renderer and UI. Game logic in
`core` does not depend on this package.

## Layout

- `runtime/`: published PNGs and manifests, grouped into `characters`,
  `backgrounds`, `effects`, `tablets`, `battle-ui`, and `ui`.
- `src/manifest.ts`: manifest types. Each frame has a stable ID, an image path
  relative to `runtime/`, a crop rectangle, a logical canvas size, alignment, and
  an optional offset. Image sheets are retained without resampling.
- `sources/prompts/`: generation descriptions, separated by original art family.
- `sources/references/`: retired alternatives, the original character/style atlas,
  and historical manifest/documentation. These are production references, not the
  current runtime specification, and are not published or served by the mock app.

Multiple frames can share a PNG. Character frames preserve their logical canvas
and feet alignment; inventory icons use cached square views of the same images.
UI crops, including the drawer tab's transparent-margin crop, live in manifests
rather than component code.

## Loading and ownership

```ts
import {
  loadGroup,
  loadTabletArt,
  unloadAllAssets,
} from "@infinite-build/assets";

await loadGroup("ui");
const art = await loadTabletArt(); // loads only the tablets group
await loadGroup("battle"); // characters + backgrounds + effects + tablets + battle-ui

// Only after every view using these shared textures has been destroyed:
await unloadAllAssets();
```

The package owns all loaded source textures and cropped views. Components own
sprites and containers; destroying a scene must not destroy shared textures.
Assets remain cached across scene changes. Concurrent loads reuse the same group
promise and image source, and failed requests can be retried. Loading after an
explicit unload creates fresh textures.

The current game initializes its UI and battlefield together, so it still loads
all groups during startup. Separate loading groups let other views request only
their own resources; per-level loading can be added when needed.

The `loadBattlefieldAssets()` and `loadDrawerAssets()` adapters expose typed
collections for existing consumers. `loadTabletArt()` returns shared square icon
textures. Business code references semantic IDs and collections, not image paths
or crop coordinates.

## Adding or replacing art

1. Put the PNG in the appropriate runtime group. Keep generation notes or
   reference images under `sources/`.
2. Add or update the group's `manifest.json`. Preserve existing IDs when replacing
   artwork. Use unique frame IDs across all manifests, and reference frames in the
   group's semantic mappings or animation clips.
3. Run `pnpm assets:check`, format changed manifests/code, and run relevant tests.

The check reports missing images/frames, invalid crop bounds, duplicate frame
IDs, invalid animation clips, and unreferenced images/frames. It never deletes
assets automatically.

## Development and distribution

Run `pnpm assets:check` from the repository root. Run
`pnpm --filter @infinite-build/assets test` after building this package.

Ship `dist/` and `runtime/` together and preserve their relative paths. The mock
server exposes `/assets/dist/` and `/assets/runtime/`, and reloads when runtime
art changes. It does not serve `sources/`. Browser consumers need import-map or
bundler mappings for this package and `pixi.js`.
