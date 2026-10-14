import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const animations = ["idle", "walk", "cast", "attack", "hit", "death"];
export async function checkAssets(root) {
  const errors = [];
  const warnings = [];
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(path);
    }
  }
  await walk(root);
  const ids = new Set();
  const usedImages = new Set();
  const dimensions = new Map();
  const manifests = files.filter((path) => path.endsWith("/manifest.json"));
  const expected = [
    "characters",
    "backgrounds",
    "effects",
    "tablets",
    "battle-ui",
    "ui",
  ];
  for (const group of expected) {
    if (!manifests.includes(resolve(root, group, "manifest.json")))
      errors.push(`Missing manifest: ${group}`);
  }
  for (const file of manifests) {
    const label = relative(root, file);
    let manifest;
    try {
      manifest = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
      continue;
    }
    if (!manifest.frames || typeof manifest.frames !== "object") {
      errors.push(`${label}: missing frames`);
      continue;
    }
    const referenced = new Set();
    function reference(id) {
      if (typeof id !== "string" || !Object.hasOwn(manifest.frames, id))
        errors.push(`${label}: missing frame ${String(id)}`);
      else referenced.add(id);
    }
    for (const field of [
      "backgrounds",
      "icons",
      "affixIcons",
      "skillTablets",
      "playbackIcons",
      "ui",
    ]) {
      for (const id of Object.values(manifest[field] ?? {})) reference(id);
    }
    for (const id of Object.values(manifest.affixCategories ?? {}))
      reference(id);
    for (const visual of Object.values(manifest.affixVisuals ?? {}))
      if (visual.icon !== undefined) reference(visual.icon);
    if (manifest.defaultAffixIcon !== undefined)
      reference(manifest.defaultAffixIcon);
    if (manifest.progressFrame !== undefined) reference(manifest.progressFrame);
    for (const entries of Object.values(manifest.settlement ?? {}))
      for (const id of Object.values(entries)) reference(id);
    for (const [name, frames] of Object.entries(manifest.effects ?? {})) {
      if (!Array.isArray(frames) || !frames.length)
        errors.push(`${label}: empty effect ${name}`);
      else frames.forEach(reference);
    }
    for (const [name, character] of Object.entries(manifest.characters ?? {})) {
      if (!Number.isFinite(character.scale) || character.scale <= 0)
        errors.push(`${label}: invalid scale ${name}`);
      for (const action of animations) {
        const clip = character.animations?.[action];
        if (
          !clip ||
          !Array.isArray(clip.frames) ||
          !clip.frames.length ||
          !Number.isFinite(clip.durationMs) ||
          clip.durationMs <= 0 ||
          typeof clip.loop !== "boolean"
        ) {
          errors.push(`${label}: invalid animation ${name}.${action}`);
          continue;
        }
        clip.frames.forEach(reference);
      }
    }
    for (const [id, entry] of Object.entries(manifest.frames)) {
      if (ids.has(id)) errors.push(`${label}: duplicate resource ID ${id}`);
      ids.add(id);
      if (!referenced.has(id))
        warnings.push(`${label}: unreferenced frame ${id}`);
      if (typeof entry.image !== "string") {
        errors.push(`${label}: missing image for ${id}`);
        continue;
      }
      const path = resolve(root, entry.image);
      if (relative(root, path).startsWith("..") || extname(path) !== ".png") {
        errors.push(`${label}: invalid image path ${entry.image}`);
        continue;
      }
      usedImages.add(path);
      let size = dimensions.get(path);
      if (!size) {
        try {
          const bytes = await readFile(path);
          if (
            bytes.length < 24 ||
            bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
            bytes.toString("ascii", 12, 16) !== "IHDR"
          )
            throw new Error("not a PNG");
          size = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
          dimensions.set(path, size);
        } catch (error) {
          errors.push(`${label}: ${entry.image}: ${error.message}`);
          continue;
        }
      }
      const frame = entry.frame;
      if (
        !Array.isArray(frame) ||
        frame.length !== 4 ||
        !frame.every(Number.isInteger) ||
        frame[0] < 0 ||
        frame[1] < 0 ||
        frame[2] <= 0 ||
        frame[3] <= 0 ||
        frame[0] + frame[2] > size[0] ||
        frame[1] + frame[3] > size[1]
      )
        errors.push(`${label}: out-of-bounds or invalid frame ${id}`);
      if (
        !Array.isArray(entry.size) ||
        entry.size.length !== 2 ||
        !entry.size.every((n) => Number.isInteger(n) && n > 0)
      )
        errors.push(`${label}: invalid canvas size ${id}`);
      if (!["center", "feet"].includes(entry.alignment))
        errors.push(`${label}: invalid alignment ${id}`);
      if (
        entry.offset !== undefined &&
        (!Array.isArray(entry.offset) ||
          entry.offset.length !== 2 ||
          !entry.offset.every(Number.isFinite))
      )
        errors.push(`${label}: invalid offset ${id}`);
    }
  }
  for (const file of files)
    if (extname(file) === ".png" && !usedImages.has(file))
      warnings.push(`Unreferenced image: ${relative(root, file)}`);
  return {
    errors,
    warnings,
    manifests: manifests.length,
    images: usedImages.size,
    frames: ids.size,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkAssets(
    fileURLToPath(new URL("../runtime/", import.meta.url)),
  );
  for (const warning of result.warnings) console.warn(warning);
  for (const error of result.errors) console.error(error);
  console.log(
    `Assets: ${result.manifests} manifests, ${result.images} images, ${result.frames} frames; ${result.errors.length} errors, ${result.warnings.length} warnings.`,
  );
  if (result.errors.length) process.exitCode = 1;
}
