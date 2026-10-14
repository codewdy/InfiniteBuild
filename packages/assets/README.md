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
3. Format changed manifests/code and run `pnpm assets:check`.

The check reports missing images/frames, invalid crop bounds, duplicate frame
IDs, invalid animation clips, and unreferenced images/frames. It never deletes
assets automatically.

## Development and distribution

Run `pnpm assets:check` from the repository root.

Ship `dist/` and `runtime/` together and preserve their relative paths. The mock
server exposes `/assets/dist/` and `/assets/runtime/`, and reloads when runtime
art changes. It does not serve `sources/`. Browser consumers need import-map or
bundler mappings for this package and `pixi.js`.

## Skills, affixes, and effect behavior

`runtime/tablets/manifest.json` owns `skillIcons`, `affixVisuals`,
`affixCategories`, `defaultSkillIcon`, and `defaultAffixIcon`. A skill explicitly
chooses an icon alias and optional rarity icon overrides. It contains no effect
IDs or character animation settings. Inventory icons and
battle skill-progress icons use this same mapping. Unknown runtime skill IDs use
the configured generic icon, but the content check rejects missing skill mappings.

Affixes resolve a dedicated frame first, then their category's frame, then the
generic frame. Normal numeric affixes can reuse a category without new artwork.
Explicit invalid references are errors; an uncategorized affix using the generic
frame produces a warning. Rarity variants are optional: absent variants reuse the
base icon, so new skills do not require a complete set of rarity PNGs.

`runtime/effects/manifest.json` maps effect IDs to a frame-sequence ID and one of
`projectile`, `wave`, or `target-strike`. Game events retain semantic effect IDs;
the renderer selects behavior from the mapping, never from a skill name. New
skills can reuse these behaviors and existing frames. A new behavior requires a
new renderer factory and entry in `effectRenderers`; keep the declared renderer types and factory registry in sync.
The projectile and target-strike behaviors expect `from`, `to`, and
`durationFrames` payload fields; wave expects `center`, `radius`, and
`durationFrames`.

To add content:

1. Define the skill or affix in game data.
2. Add its visual mapping. Reuse an existing icon/category when appropriate.
3. For skills with effects, map the emitted effect IDs to behavior and frame
   sequences. Add new PNGs and frame definitions only when needed.
4. Run `pnpm assets:check`. It builds the content and assets packages, validates
   asset files, and cross-checks the mock game data against visual mappings.

The root `scripts/check-visuals.mjs` joins content and art for validation. Neither
`core` nor game-data definitions depend on asset types or Pixi. Alternate content
sets can call the reusable checker with their own skill and affix IDs.

## Cast events and character actions

Core records at most one `Cast` event (`source`, `skill`, `uuid`) per unit per
frame, retaining that unit's first skill execution before its effects and damage.
Later casts still execute normally; different units retain their own events.
The per-frame deduplication resets when the event manager is cleared.
It records an execution attempt, even
when the skill immediately returns without a target; it does not imply success.
Generator continuations and delayed effects do not emit another Cast.

`runtime/characters/manifest.json` contains `castAnimations`, mapping skill IDs to
`cast` or `attack`; absent entries default to `cast`. Only Cast starts the actor's
action animation. Effect events independently render visuals and may update
facing toward their target, but do not restart the casting animation. Dead or
missing actors ignore Cast animation requests. Cast events are not subject to
the visual-effect event limit.

Skill icons, character cast actions, and effects are separate mappings. There is
no skill-icon-to-effect declaration: the effect ID emitted by game logic selects
the effect configuration directly.
