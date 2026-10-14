import assert from "node:assert/strict";
import { readFile, mkdtemp, cp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Assets, Texture, TextureSource } from "pixi.js";
import {
  loadGroup,
  loadTabletArt,
  loadDrawerAssets,
  loadBattlefieldAssets,
  unloadAllAssets,
} from "../dist/index.js";
import { checkAssets } from "../scripts/check.mjs";

const runtime = fileURLToPath(new URL("../runtime/", import.meta.url));

test("runtime manifests have valid images, references and animation crops", async () => {
  const result = await checkAssets(runtime);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.manifests, 6);
});

test("validator reports broken references, duplicate IDs, crops, animations and unused images", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "infinite-assets-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(runtime, root, { recursive: true });
  const path = join(root, "characters/manifest.json");
  const data = JSON.parse(await readFile(path, "utf8"));
  data.characters.Player.animations.walk.frames = ["missing"];
  data.characters.Player.animations.death.durationMs = 0;
  const entry = Object.values(data.frames)[0];
  entry.frame[2] = 999999;
  const ui = JSON.parse(await readFile(join(root, "ui/manifest.json"), "utf8"));
  data.frames["ui.board"] = ui.frames["ui.board"];
  await writeFile(path, JSON.stringify(data));
  await cp(
    join(root, "ui/tablet-board-background.png"),
    join(root, "ui/unused.png"),
  );
  const result = await checkAssets(root);
  for (const message of [
    "missing frame missing",
    "duplicate resource ID ui.board",
    "invalid frame",
    "invalid animation",
  ]) {
    assert.ok(
      result.errors.some((error) => error.includes(message)),
      message,
    );
  }
  assert.ok(result.warnings.some((warning) => warning.includes("unused.png")));
});

test("groups load independently, share textures, retry failures and release centrally", async (t) => {
  const manifests = [];
  const images = [];
  const unloaded = [];
  let failUI = true;
  t.mock.method(globalThis, "fetch", async (url) => {
    const path = fileURLToPath(url);
    manifests.push(path);
    if (path.endsWith("/ui/manifest.json") && failUI) {
      failUI = false;
      return { ok: false, status: 503 };
    }
    return {
      ok: true,
      json: async () => JSON.parse(await readFile(path, "utf8")),
    };
  });
  t.mock.method(Assets, "load", async (url) => {
    images.push(url);
    const bytes = await readFile(fileURLToPath(url));
    return new Texture({
      source: new TextureSource({
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
      }),
    });
  });
  t.mock.method(Assets, "unload", async (url) => {
    unloaded.push(url);
  });
  t.after(() => unloadAllAssets());

  const [first, second] = await Promise.all([
    loadGroup("tablets"),
    loadGroup("tablets"),
  ]);
  assert.equal(first, second);
  assert.equal(manifests.length, 1);
  assert.ok(images.every((url) => url.includes("/tablets/")));
  const art = await loadTabletArt();
  const again = await loadTabletArt();
  assert.equal(art.icons.fireball, again.icons.fireball);
  assert.equal(art.icons.fireball.width, art.icons.fireball.height);

  await assert.rejects(loadDrawerAssets(), /503/);
  const drawer = await loadDrawerAssets();
  assert.equal(drawer.playerHandle.width, 1780);
  assert.equal(drawer.playerHandle.height, 400);
  assert.equal(drawer.playerHandle.frame.x, 100);
  assert.equal(drawer.playerHandle.frame.y, 197);
  const battle = await loadBattlefieldAssets();
  assert.equal(battle.characters.Player.animations.walk.frames.length, 4);
  assert.equal(battle.characters.Player.animations.death.loop, false);
  assert.equal(battle.characters.Player.animations.death.durationMs, 600);
  assert.equal(battle.nova.length, 1);
  assert.equal(new Set(images).size, images.length);
  assert.equal(
    manifests.filter((path) => path.endsWith("/tablets/manifest.json")).length,
    1,
  );
  await unloadAllAssets();
  assert.equal(unloaded.length, images.length);
  assert.equal(art.icons.fireball.destroyed, true);
  const fresh = await loadTabletArt();
  assert.notEqual(fresh.icons.fireball, art.icons.fireball);
});
