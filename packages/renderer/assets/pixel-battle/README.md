# Pixel battle assets

`atlas.png` is a 1254 × 1254 RGBA image generated with the built-in image_gen tool from the approved fantasy pixel-art preview. The generation prompt is recorded in `prompt.txt`.

`atlas.json` describes two poses each for Player, Slime and Goblin, three fireball stages, and a standalone nova ring texture. The character textures use a shared logical canvas and a feet anchor; effects use a centered canvas. Image regions are intentionally specified individually because the generated sheet is not an exact uniform grid.

The loader in `src/battlefield-assets.ts` shares one atlas source and uses nearest-neighbor sampling. Scene resets destroy sprites without destroying the shared textures. Add source regions and character/effect mappings to the manifest to extend this set.

This is an initial two-pose animation set: walking alternates poses, casts use the action pose, and interpolation, hit flashes and death transforms are applied at runtime. It is not a full walk/attack animation cycle. Inventory tablet icons are outside this asset set; settlement tablet icons use the additional atlas described below.

`nova-ring.png` is a transparent circular shockwave generated separately with the built-in image_gen tool. Its prompt is recorded in `nova-ring-prompt.txt`. A frame may select an additional image using its `image` field. The ring texture itself expands to the skill radius and fades over the effect duration; no procedural circle is drawn behind it. The player remains above effects.

`background-forest.png` is a moonlit pixel-art forest clearing generated with the built-in image_gen tool. Its prompt is in `background-prompt.txt`; the manifest selects it using `background`. The renderer draws it below all characters and effects and uses nearest-neighbor sampling. Two viewport-covering tiles alternate horizontal mirroring so repeated edges match. Their horizontal offset follows the interpolated player camera at the same world-to-screen scale as the actors; stationary players do not scroll the background, and battle resets return it to the start.

`settlement-icons.png` is a transparent eight-icon sprite atlas generated with the built-in image_gen tool. The exact prompt is in `settlement-prompt.txt`. It contains victory/defeat emblems, skill/passive/support tablets, a pending-loot chest, and an XP crystal. Their individual regions and role mappings are stored in `atlas.json` under `frames` and `settlement` so replacement art does not require rewriting pixel patterns in TypeScript.

Settlement rendering uses shared `Sprite` textures, nearest-neighbor sampling, and dynamic text for counts and XP. It has no panel background, border, or progress bar. The two-line overlay displays for one second independently of the half-second transition between battles; destroying a settlement's sprites leaves the shared atlas textures intact.
