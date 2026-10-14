import { readFile } from "node:fs/promises";
import { gameData } from "../packages/mock-data/dist/index.js";
import { effectRenderers } from "../packages/assets/dist/index.js";
import { checkVisuals } from "../packages/assets/scripts/check-visuals.mjs";

const root = new URL("../packages/assets/runtime/", import.meta.url);
const tablets = JSON.parse(
  await readFile(new URL("tablets/manifest.json", root), "utf8"),
);
const effects = JSON.parse(
  await readFile(new URL("effects/manifest.json", root), "utf8"),
);
const characters = JSON.parse(
  await readFile(new URL("characters/manifest.json", root), "utf8"),
);
const manifest = {
  castAnimations: characters.castAnimations,
  ...tablets,
  ...effects,
  frames: { ...tablets.frames, ...effects.frames },
};
const result = checkVisuals(manifest, {
  skills: Object.keys(gameData.skillDefinitions),
  affixes: [
    ...new Set(
      Object.values(gameData.affixDefinition.tablet).flatMap((definition) =>
        Object.keys(definition.pool),
      ),
    ),
  ],
  renderers: effectRenderers,
});
for (const warning of result.warnings) console.warn(warning);
for (const error of result.errors) console.error(error);
console.log(
  `Content visuals: ${result.errors.length} errors, ${result.warnings.length} warnings.`,
);
if (result.errors.length) process.exitCode = 1;
