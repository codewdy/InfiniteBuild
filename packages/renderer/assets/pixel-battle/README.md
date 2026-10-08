# Pixel battle assets

`atlas.png` is a 1254 × 1254 RGBA image generated with the built-in image_gen tool from the approved fantasy pixel-art preview. The generation prompt is recorded in `prompt.txt`.

`atlas.json` describes the character animation clips, three fireball stages, and a standalone nova ring texture. The character textures use a shared logical canvas and a feet anchor; effects use a centered canvas. Image regions are intentionally specified individually because the generated sheets are not exact uniform grids. Optional frame offsets preserve the slime's airborne walk pose above the ground baseline.

The loader in `src/battlefield-assets.ts` shares one atlas source and uses nearest-neighbor sampling. Scene resets destroy sprites without destroying the shared textures. Add source regions and character/effect mappings to the manifest to extend this set.

`mage-animations.png`, `slime-animations.png`, and `goblin-animations.png` are transparent animation sheets generated with the built-in image_gen tool using `atlas.png` as the character identity and style reference. Exact prompts are recorded in the corresponding `*-animations-prompt.txt` files. Each contains four frames for each of five actions: walk, cast, attack, hit, and death. Idle uses the first walk pose. All new sprites face right; the renderer mirrors them to face movement or a skill's target. The original two-pose regions remain available in the atlas but are no longer used for character animation.

Each character's manifest entry specifies display scale and named clips with frame lists, duration, and looping. Runtime priority is death, hit, attack/cast, walk, then idle. Position changes trigger walking; skill effect events trigger attack (the `attack` skill/effect) or casting; positive damage triggers hit; zero HP or removal from the next log triggers death. Action clips play once. Death holds the fallen pose and fades over 200 ms after its 600 ms clip. Health and name labels hide on death, and sprites are destroyed only after the fade. Pausing freezes the animation clock; manual steps play their feedback once and final deaths finish during settlement. Battle resets clear all animation state and preserve shared textures.

Inventory tablet icons are outside this asset set; settlement tablet icons use the additional atlas described below.

`nova-ring.png` is a transparent circular shockwave generated separately with the built-in image_gen tool. Its prompt is recorded in `nova-ring-prompt.txt`. A frame may select an additional image using its `image` field. The ring texture itself expands to the skill radius and fades over the effect duration; no procedural circle is drawn behind it. The player remains above effects.

`background-forest.png` is a moonlit pixel-art forest clearing generated with the built-in image_gen tool. Its prompt is in `background-prompt.txt`; the manifest selects it using `background`. The renderer draws it below all characters and effects and uses nearest-neighbor sampling. Two viewport-covering tiles alternate horizontal mirroring so repeated edges match. Their horizontal offset follows the interpolated player camera at the same world-to-screen scale as the actors; stationary players do not scroll the background, and battle resets return it to the start.

`settlement-icons.png` is a transparent eight-icon sprite atlas generated with the built-in image_gen tool. The exact prompt is in `settlement-prompt.txt`. It contains victory/defeat emblems, skill/passive/support tablets, a pending-loot chest, and an XP crystal. Their individual regions and role mappings are stored in `atlas.json` under `frames` and `settlement` so replacement art does not require rewriting pixel patterns in TypeScript.

Settlement rendering uses shared `Sprite` textures, nearest-neighbor sampling, and dynamic text for counts and XP. It has no panel background, border, or progress bar. The two-line overlay displays for one second independently of the half-second transition between battles; destroying a settlement's sprites leaves the shared atlas textures intact.
