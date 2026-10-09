import { GameUI } from "@infinite-build/ui";
import { loadBattlefieldIcons, loadPassiveAffixIcons } from "@infinite-build/renderer";
import type { IconName, IconAsset } from "@infinite-build/renderer";
import type { BattlefieldResult } from "@infinite-build/renderer";
import {
  Battle,
  Game,
  TabletMap,
  RandomGenerator,
  derivePlayerCombatProfile,
} from "@infinite-build/core";
import type {
  BattleLog,
  BattleSettlement,
  PlayerState,
  TabletSpec,
} from "@infinite-build/core";
import {
  battleSpec,
  createPassiveTablet,
  createSupportTablet,
  gameData,
  tabletOptions,
  passiveTabletOptions,
  rollPassiveTablet,
} from "@infinite-build/mock-data";

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing element: ${id}`);
  return result as T;
}

const canvas = element<HTMLCanvasElement>("battlefield");
const resolution = element<HTMLSelectElement>("resolution");
const battlefieldViewport = element<HTMLDivElement>("battlefield-viewport");
const battlefieldStage = element<HTMLDivElement>("battlefield-stage");
const customResolution = element<HTMLDivElement>("custom-resolution");
const customWidth = element<HTMLInputElement>("custom-width");
const customHeight = element<HTMLInputElement>("custom-height");
const customZoom = element<HTMLInputElement>("custom-zoom");
const customZoomValue = element<HTMLOutputElement>("custom-zoom-value");
const resizeHandle = element<HTMLButtonElement>("resolution-resize");
let customSize = { width: 1024, height: 768 };
let resizeDrag: { pointerId: number; x: number; y: number; width: number; height: number; scale: number } | undefined;

function setCustomSize(width: number, height: number): void {
  width = Math.round(Math.min(2560, Math.max(256, Number.isFinite(width) ? width : customSize.width)));
  // Keep room for UI even at the battlefield's widest allowed aspect ratio.
  const minHeight = Math.max(320, Math.ceil(width * 9 / 21) + 160);
  height = Math.round(Math.min(2560, Math.max(minHeight, Number.isFinite(height) ? height : customSize.height)));
  customSize = { width, height };
  customWidth.value = String(width);
  customHeight.value = String(height);
  customHeight.min = String(minHeight);
}

function applyResolution(): void {
  const selected = resolution.selectedOptions[0];
  const dimensions = resolution.value.match(/^(\d+)x(\d+)$/);
  const availableWidth = Math.max(1, battlefieldViewport.clientWidth);
  const availableHeight = Math.max(1, window.innerHeight * 0.8);
  const mobile = window.matchMedia("(max-width: 700px)").matches;
  const custom = resolution.value === "custom";
  customResolution.hidden = resizeHandle.hidden = !custom;
  battlefieldViewport.dataset.custom = String(custom);
  const width = custom ? customSize.width : dimensions ? Number(dimensions[1]) : mobile ? 390 : 1024;
  const height = custom ? customSize.height : dimensions ? Number(dimensions[2]) : mobile ? 844 : 768;
  const scale = custom ? Number(customZoom.value) / 100 : Math.min(1, availableWidth / width, availableHeight / height);
  customZoomValue.value = `${customZoom.value}%`;
  // Transform only the preview; Pixi keeps rendering at the selected dimensions.
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.transform = `scale(${scale})`;
  battlefieldStage.style.width = `${width * scale}px`;
  battlefieldStage.style.height = `${height * scale}px`;
  canvas.setAttribute(
    "aria-label",
    `像素战场、石板盘和背包 · ${selected?.textContent ?? "自适应"} · ${width} × ${height}`,
  );
}
applyResolution();
resolution.addEventListener("change", () => {
  if (resolution.value === "custom") {
    setCustomSize(canvas.clientWidth, canvas.clientHeight);
    customZoom.value = String(Math.max(10, Math.floor(Math.min(1,
      battlefieldViewport.clientWidth / customSize.width,
      window.innerHeight * 0.8 / customSize.height,
    ) * 100)));
  }
  applyResolution();
});
for (const input of [customWidth, customHeight]) {
  input.addEventListener("change", () => {
    setCustomSize(customWidth.valueAsNumber, customHeight.valueAsNumber);
    applyResolution();
  });
}
customZoom.addEventListener("input", applyResolution);
resizeHandle.addEventListener("pointerdown", event => {
  if (event.button !== 0 || resizeDrag) return;
  event.preventDefault();
  resizeHandle.focus();
  resizeDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, ...customSize, scale: Number(customZoom.value) / 100 };
  resizeHandle.setPointerCapture(event.pointerId);
});
resizeHandle.addEventListener("pointermove", event => {
  if (!resizeDrag || resizeDrag.pointerId !== event.pointerId) return;
  setCustomSize(resizeDrag.width + (event.clientX - resizeDrag.x) / resizeDrag.scale,
    resizeDrag.height + (event.clientY - resizeDrag.y) / resizeDrag.scale);
  applyResolution();
});
function endResize(): void {
  const pointerId = resizeDrag?.pointerId;
  resizeDrag = undefined;
  if (pointerId !== undefined && resizeHandle.hasPointerCapture(pointerId)) resizeHandle.releasePointerCapture(pointerId);
}
resizeHandle.addEventListener("pointerup", endResize);
resizeHandle.addEventListener("pointercancel", endResize);
resizeHandle.addEventListener("lostpointercapture", endResize);
window.addEventListener("blur", endResize);
resizeHandle.addEventListener("keydown", event => {
  const delta = event.shiftKey ? 50 : 10;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  setCustomSize(customSize.width + (event.key === "ArrowRight" ? delta : event.key === "ArrowLeft" ? -delta : 0),
    customSize.height + (event.key === "ArrowDown" ? delta : event.key === "ArrowUp" ? -delta : 0));
  applyResolution();
});
window.addEventListener("resize", applyResolution);
const viewportObserver = new ResizeObserver(applyResolution);
viewportObserver.observe(battlefieldViewport);
window.addEventListener("pagehide", () => {
  endResize();
  window.removeEventListener("blur", endResize);
  viewportObserver.disconnect();
  window.removeEventListener("resize", applyResolution);
}, { once: true });
const gameUI = await GameUI.create(canvas, {
  gameData,
  onMoveTablet: moveTablet,
  onRotateTablet: rotateTablet,
  onClaimLoot: (loot, count) => {
    const opened = game.openLoots(loot, count);
    submitState(opened.player, "validate", `已领取 ${opened.items.length} 件战利品`);
  },
});
const battlefield = gameUI.battlefield;
const iconAssets = await loadBattlefieldIcons();
const passiveAffixIcons = await loadPassiveAffixIcons();

function assetIcon(name: IconName | IconAsset): SVGSVGElement {
  const asset = typeof name === "string" ? iconAssets[name] : name;
  const [x, y, width, height] = asset.frame;
  const size = Math.max(width, height);
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.classList.add("asset-icon");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("aria-hidden", "true");
  const crop = document.createElementNS(namespace, "svg");
  crop.setAttribute("x", String((size - width) / 2));
  crop.setAttribute("y", String((size - height) / 2));
  crop.setAttribute("width", String(width));
  crop.setAttribute("height", String(height));
  crop.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  crop.setAttribute("overflow", "hidden");
  const image = document.createElementNS(namespace, "image");
  image.setAttribute("href", asset.image);
  image.setAttribute("width", String(asset.imageWidth));
  image.setAttribute("height", String(asset.imageHeight));
  crop.append(image);
  svg.append(crop);
  return svg;
}
window.addEventListener("pagehide", () => gameUI.destroy(), { once: true });
const play = element<HTMLButtonElement>("play");
const step = element<HTMLButtonElement>("step");
const speed = element<HTMLSelectElement>("speed");
const tabletBoard = element<HTMLDivElement>("tablet-board");
const tabletMessage = element<HTMLParagraphElement>("tablet-message");
const logs = element<HTMLPreElement>("logs");
const vision = gameData.config.map.visionRange;
const skillNames = Object.fromEntries(
  Object.entries(gameData.skillDefinitions).map(([id, definition]) => [id, definition.name]),
);
const game = new Game(gameData);
const inventoryCapacity = gameData.playerDefinition.inventoryCapacity;
const lootNames: Record<PlayerState["pendingLoot"][number]["loot"]["kind"], string> = {
  "tablet-skill": "技能石板",
  "tablet-passive": "被动石板",
  "tablet-support-skill": "辅助石板",
  "tablet-support-passive": "辅助石板",
};
let round = 1;
function tabletName(tablet: TabletSpec.Tablet): string {
  if (tablet.kind === "tablet-passive") return "被动石板";
  if (tablet.kind !== "tablet-skill") {
    return "辅助石板";
  }
  return (
    tabletOptions.find((option) => option.kind === tablet.skill)?.name ??
    tablet.skill
  );
}

function affixText(
  tablet: Exclude<TabletSpec.Tablet, TabletSpec.Skill>,
  affix: TabletSpec.Passive["affixes"][number],
): string {
  const definitions =
    tablet.kind === "tablet-passive"
      ? gameData.affixDefinition.tablet.passive
      : gameData.affixDefinition.tablet.support;
  const description =
    definitions.pool[affix.id]?.description(affix.param) ?? affix.id;
  return `${description} · T${affix.tier + 1}`;
}

function submitState(
  state: PlayerState,
  mode: "validate" | "force" = "validate",
  message = "石板已修改",
): void {
  if (mode === "force") game.forceChangeState(state);
  const error = mode === "validate" ? game.changeState(state) : null;
  if (error) {
    tabletMessage.textContent = `修改失败：${error.message}`;
    tabletMessage.dataset.error = "true";
  } else {
    tabletMessage.dataset.error = "false";
    if (log.status === "Running") {
      battle.changeState(game.getState());
      tabletMessage.textContent = `${message}，下一帧生效。`;
    } else {
      tabletMessage.textContent = `${message}，点击重新开始使用新构筑。`;
    }
  }
  render();
}

type SlotLocation = { area: "tablets" | "inventory"; index: number };
let selectedUuid: string | undefined;
let draggingUuid: string | undefined;
let renderedLoadout = "";

function tabletAt(
  state: PlayerState,
  location: SlotLocation,
): TabletSpec.Tablet | null {
  return state[location.area][location.index] ?? null;
}

function setTablet(
  state: PlayerState,
  location: SlotLocation,
  tablet: TabletSpec.Tablet | null,
): void {
  state[location.area][location.index] = tablet;
}

function moveTablet(uuid: string, target: SlotLocation): void {
  const state = game.getState();
  const equipped = state.tablets.findIndex((tablet) => tablet?.uuid === uuid);
  const stored = state.inventory.findIndex((item) => item?.uuid === uuid);
  const source: SlotLocation =
    equipped >= 0
      ? { area: "tablets", index: equipped }
      : { area: "inventory", index: stored };
  if (
    source.index < 0 ||
    (source.area === target.area && source.index === target.index)
  )
    return;
  const tablet = tabletAt(state, source);
  if (!tablet) return;
  setTablet(state, source, tabletAt(state, target));
  setTablet(state, target, tablet);
  selectedUuid = undefined;
  submitState(state);
}

function rotateTablet(uuid: string): void {
  const state = game.getState();
  const tablet = [...state.tablets, ...state.inventory].find(item => item?.uuid === uuid);
  if (!tablet || !("rotate" in tablet)) return;
  const rotations = [0, 90, 180, 270] as const;
  tablet.rotate = rotations[(rotations.indexOf(tablet.rotate) + 1) % rotations.length]!;
  submitState(state, "validate", `${tabletName(tablet)}已旋转至 ${tablet.rotate}°`);
}

function discardTablet(uuid: string): void {
  const state = game.getState();
  const equipped = state.tablets.findIndex((tablet) => tablet?.uuid === uuid);
  const stored = state.inventory.findIndex((item) => item?.uuid === uuid);
  if (equipped < 0 && stored < 0) return;
  game.deleteItem(uuid);
  selectedUuid = undefined;
  draggingUuid = undefined;
  submitState(game.getState(), "validate", "石板已删除");
}

const trash = element<HTMLButtonElement>("tablet-trash");
trash.addEventListener("dragover", (event) => {
  if (!draggingUuid) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  trash.classList.add("drop-target");
});
trash.addEventListener("dragleave", () =>
  trash.classList.remove("drop-target"),
);
trash.addEventListener("drop", (event) => {
  event.preventDefault();
  trash.classList.remove("drop-target");
  const uuid = draggingUuid;
  draggingUuid = undefined;
  if (uuid && event.dataTransfer?.getData("text/plain") === uuid)
    discardTablet(uuid);
  renderTablets();
});
trash.addEventListener("click", () => {
  if (selectedUuid) discardTablet(selectedUuid);
  else
    tabletMessage.textContent = "将石板拖入垃圾箱，或先选中石板再点击垃圾箱。";
});

function addTabletToInventory(
  state: PlayerState,
  tablet: TabletSpec.Tablet,
  message: string,
): void {
  const empty = state.inventory.findIndex(
    (item, index) => index < inventoryCapacity && item === null,
  );
  if (empty < 0) {
    tabletMessage.textContent = "背包已满，请先装备或删除石板腾出空间。";
    tabletMessage.dataset.error = "true";
    return;
  }
  state.inventory[empty] = tablet;
  selectedUuid = undefined;
  submitState(state, "force", message);
}

for (const option of tabletOptions) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "add-tablet";
  button.dataset.skill = option.kind;
  button.textContent = `＋ 新增${option.name}`;
  button.title = option.description;
  button.addEventListener("click", () => {
    const state = game.getState();
    const tablet: TabletSpec.Tablet = {
      kind: "tablet-skill",
      uuid: crypto.randomUUID(),
      rarity: "magic",
      affixes: [],
      skill: option.kind,
    };
    addTabletToInventory(state, tablet, `${option.name}已加入背包`);
  });
  element("tablet-add-actions").append(button);
}

const hasteButton = document.createElement("button");
hasteButton.type = "button";
hasteButton.className = "add-tablet";
hasteButton.dataset.skill = "tablet-support-skill";
hasteButton.textContent = "＋ 新增辅助石板";
hasteButton.title =
  "辅助箭头方向的技能石板，持续施放速率提升(add) 50%。右键旋转方向。";
hasteButton.addEventListener("click", () => {
  const state = game.getState();
  const tablet = createSupportTablet(state.inventory.length);
  tablet.uuid = crypto.randomUUID();
  addTabletToInventory(state, tablet, "辅助石板已加入背包");
});
element("tablet-add-actions").append(hasteButton);

const lifeButton = document.createElement("button");
lifeButton.type = "button";
lifeButton.className = "add-tablet";
lifeButton.dataset.skill = "tablet-passive";
lifeButton.textContent = "＋ 新增被动石板";
lifeButton.title = "装备后最大生命值 +10。";
lifeButton.addEventListener("click", () => {
  const state = game.getState();
  const tablet = createPassiveTablet(state.inventory.length);
  tablet.uuid = crypto.randomUUID();
  addTabletToInventory(state, tablet, "被动石板已加入背包");
});
element("tablet-add-actions").append(lifeButton);

const passiveRng = new RandomGenerator(
  crypto.getRandomValues(new Uint32Array(1))[0]!,
);
for (const option of passiveTabletOptions) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "add-tablet";
  button.dataset.skill = "tablet-passive";
  button.textContent = `＋ ${option.name}被动石板`;
  button.title = `等级 ${option.level} · 随机生成 1–2 条攻击或生命词缀，最高 T${option.level === 1 ? 1 : option.level === 20 ? 3 : 5}`;
  button.addEventListener("click", () => {
    const state = game.getState();
    const tablet = rollPassiveTablet(passiveRng, option.level);
    addTabletToInventory(
      state,
      tablet,
      `${option.name}被动石板（等级 ${option.level}）已加入背包`,
    );
  });
  element("tablet-add-actions").append(button);
}

let supportPreview: SlotLocation | undefined;

function updateSupportPreview(location?: SlotLocation): void {
  supportPreview = location;
  const state = game.getState();
  const hovered = location ? tabletAt(state, location) : null;
  const sourceIds: number[] =
    location?.area === "tablets" &&
    (hovered?.kind === "tablet-skill" || hovered?.kind === "tablet-passive")
      ? JSON.parse(
          tabletBoard.querySelector<HTMLButtonElement>(
            `[data-slot="${location.index}"]`,
          )?.dataset.supportSources ?? "[]",
        )
      : [];
  tabletBoard
    .querySelectorAll<HTMLButtonElement>(".item-slot")
    .forEach((slot) => {
      const sources: number[] = JSON.parse(slot.dataset.supportSources ?? "[]");
      const visible =
        location?.area === "tablets" &&
        !!hovered &&
        sources.length > 0 &&
        (hovered.kind === "tablet-skill" || hovered.kind === "tablet-passive"
          ? Number(slot.dataset.slot) === location.index
          : sources.includes(location.index));
      slot.dataset.supported = String(visible);
      slot.dataset.supportSource = String(
        sourceIds.includes(Number(slot.dataset.slot)),
      );
    });
}

function createSlot(
  state: PlayerState,
  location: SlotLocation,
  supportedBy: Map<number, number[]> = new Map(),
): HTMLButtonElement {
  const tablet = tabletAt(state, location);
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = "item-slot";
  slot.dataset.area = location.area;
  slot.dataset.rarity = tablet?.rarity ?? "";
  slot.dataset.slot = String(location.index);
  slot.dataset.skill =
    tablet?.kind === "tablet-skill" ? tablet.skill : (tablet?.kind ?? "empty");
  slot.dataset.selected = String(!!tablet && tablet.uuid === selectedUuid);
  const sources =
    location.area === "tablets" ? (supportedBy.get(location.index) ?? []) : [];
  slot.dataset.supportSources = JSON.stringify(sources);
  slot.dataset.supported = "false";
  slot.addEventListener("mouseenter", () => updateSupportPreview(location));
  slot.addEventListener("mouseleave", () => {
    if (
      supportPreview?.area === location.area &&
      supportPreview.index === location.index
    ) {
      updateSupportPreview();
    }
  });
  if (location.area === "tablets" && location.index === 0)
    slot.classList.add("center-slot");
  const label =
    location.area === "tablets"
      ? `槽位 ${location.index}`
      : `背包 ${location.index}`;
  slot.setAttribute(
    "aria-label",
    `${label}：${tablet ? tabletName(tablet) : "空槽位"}${sources.length ? `，被槽位 ${sources.join("、")} 辅助` : ""}，点击选择或拖放交换${tablet && "rotate" in tablet ? "，右键或按 R 顺时针旋转" : ""}`,
  );
  slot.setAttribute("aria-pressed", slot.dataset.selected);
  slot.title = tablet
    ? `${tabletName(tablet)}\n${tablet.kind === "tablet-skill" ? (tabletOptions.find((option) => option.kind === tablet.skill)?.description ?? "") : tablet.affixes.map((affix) => `${affix.id}: ${affix.param}`).join("\n")}\n${tablet.uuid}`
    : `${label} · 拖入石板`;
  if (tablet) {
    if ("rotate" in tablet) {
      slot.title += `\n旋转 ${tablet.rotate}° · 右键或按 R 顺时针旋转`;
    }
    if (tablet.kind !== "tablet-skill") {
      slot.title = [
        tabletName(tablet),
        ...tablet.affixes.map((affix) => affixText(tablet, affix)),
        ...("rotate" in tablet ? [`旋转 ${tablet.rotate}° · 右键或按 R 顺时针旋转`] : []),
        tablet.uuid,
      ].join("\n");
    }
  }
  if (tablet?.kind === "tablet-support-skill" || tablet?.kind === "tablet-support-passive") {
    slot.title += `\n辅助对象：${tablet.kind === "tablet-support-skill" ? "技能石板" : "被动石板"}`;
  }
  if (tablet) slot.title += `\n稀有度：${tablet.rarity === "normal" ? "普通" : tablet.rarity === "rare" ? "稀有" : "魔法"}`;
  if (sources.length) slot.title += `\n被辅助：来自槽位 ${sources.join("、")}`;
  const index = document.createElement("span");
  index.className = "slot-index";
  index.textContent =
    location.area === "tablets" && location.index === 0
      ? "核心 · 0"
      : String(location.index).padStart(2, "0");
  const icon = document.createElement("span");
  icon.className = "tablet-icon";
  icon.setAttribute("aria-hidden", "true");
  if (tablet) {
    const skill = tablet.kind === "tablet-skill" && tablet.skill === "nova" ? "nova" : "fireball";
    const iconName: IconName = tablet.kind === "tablet-skill"
      ? (tablet.rarity === "normal" ? skill : `${skill}-${tablet.rarity}`)
      : tablet.kind === "tablet-passive" ? (tablet.rarity === "rare" ? "passive-rare" : "passive-magic")
      : tablet.rarity === "rare" ? "support-rare" : tablet.kind === "tablet-support-skill" ? "support-skill" : "support-passive";
    const stone = assetIcon(iconName);
    icon.append(stone);
    icon.classList.add("affixed-tablet-icon");
    stone.classList.add("tablet-center");
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const affix = tablet.affixes[quadrant];
      const segment = document.createElement("span");
      segment.className = "tablet-affix-slot";
      segment.dataset.quadrant = String(quadrant);
      segment.dataset.empty = String(!affix);
      if (affix) {
        segment.dataset.affix = affix.id;
        segment.dataset.tier = String(affix.tier);
      }
      const border = assetIcon(affix
        ? passiveAffixIcons[affix.id] ?? iconAssets["passive-quarter-empty"]
        : iconAssets["passive-quarter-empty"]);
      border.classList.add("tablet-affix-icon");
      border.style.transform = `rotate(${quadrant * 90}deg)`;
      segment.append(border);
      icon.append(segment);
    }
    if ("rotate" in tablet) stone.style.transform = `rotate(${tablet.rotate}deg)`;
  } else {
    icon.classList.add("empty-slot-icon");
    icon.textContent = "+";
  }
  const name = document.createElement("span");
  name.className = "slot-name";
  name.textContent = tablet ? tabletName(tablet) : "空槽位";
  slot.append(index, icon, name);
  if (sources.length) {
    const badge = document.createElement("span");
    badge.className = "support-badge";
    badge.textContent =
      sources.length > 1 ? `辅助 ×${sources.length}` : "被辅助";
    slot.append(badge);
  }
  const rotate = () => {
    if (!tablet || draggingUuid) return;
    rotateTablet(tablet.uuid);
  };
  slot.addEventListener("contextmenu", (event) => {
    if (!tablet || !("rotate" in tablet)) return;
    event.preventDefault();
    rotate();
  });
  slot.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "r" || !tablet || !("rotate" in tablet)) return;
    event.preventDefault();
    rotate();
    const container =
      location.area === "tablets" ? tabletBoard : element("inventory-list");
    container
      .querySelector<HTMLButtonElement>(`[data-slot="${location.index}"]`)
      ?.focus();
  });
  slot.draggable = !!tablet;
  slot.addEventListener("dragstart", (event) => {
    if (!tablet || !event.dataTransfer) return;
    updateSupportPreview();
    draggingUuid = tablet.uuid;
    selectedUuid = undefined;
    event.dataTransfer.setData("text/plain", tablet.uuid);
    event.dataTransfer.effectAllowed = "move";
    slot.classList.add("dragging");
  });
  slot.addEventListener("dragover", (event) => {
    if (!draggingUuid) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    slot.classList.add("drop-target");
  });
  slot.addEventListener("dragleave", () =>
    slot.classList.remove("drop-target"),
  );
  slot.addEventListener("drop", (event) => {
    event.preventDefault();
    slot.classList.remove("drop-target");
    const uuid = draggingUuid;
    draggingUuid = undefined;
    if (uuid && event.dataTransfer?.getData("text/plain") === uuid)
      moveTablet(uuid, location);
  });
  slot.addEventListener("dragend", () => {
    draggingUuid = undefined;
    slot.classList.remove("dragging");
    document
      .querySelectorAll(".drop-target")
      .forEach((target) => target.classList.remove("drop-target"));
    renderTablets();
  });
  slot.addEventListener("click", () => {
    if (selectedUuid) {
      const uuid = selectedUuid;
      selectedUuid = undefined;
      moveTablet(uuid, location);
    } else if (tablet) {
      selectedUuid = tablet.uuid;
      tabletMessage.textContent = "已选中石板，点击目标槽位进行移动或交换。";
    }
    renderTablets();
  });
  return slot;
}

function renderTablets(): void {
  if (draggingUuid) return;
  const state = game.getState();
  const key = JSON.stringify([state.tablets, state.inventory, state.pendingLoot, selectedUuid]);
  if (key === renderedLoadout) return;
  renderedLoadout = key;
  const supportedBy = new Map<number, number[]>();
  state.tablets.forEach((tablet, source) => {
    if (
      !tablet ||
      (tablet.kind !== "tablet-support-skill" && tablet.kind !== "tablet-support-passive")
    )
      return;
    for (const [x, y] of tablet.delta) {
      const target = TabletMap.move(source, x, y, tablet.rotate);
      const targetKind = tablet.kind === "tablet-support-skill" ? "tablet-skill" : "tablet-passive";
      if (target === undefined || state.tablets[target]?.kind !== targetKind)
        continue;
      const sources = supportedBy.get(target) ?? [];
      if (!sources.includes(source)) sources.push(source);
      supportedBy.set(target, sources);
    }
  });
  tabletBoard.replaceChildren(
    ...TabletMap.pos2Id.flatMap((row) =>
      row.map((index) =>
        createSlot(state, { area: "tablets", index }, supportedBy),
      ),
    ),
  );
  element("inventory-list").replaceChildren(
    ...Array.from({ length: inventoryCapacity }, (_, index) =>
      createSlot(state, { area: "inventory", index }),
    ),
  );
  const used = state.inventory.slice(0, inventoryCapacity).filter((item) => item !== null).length;
  element("inventory-count").textContent = `${used} / ${inventoryCapacity} 格`;
  element("tablet-add-actions").querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.disabled = used >= inventoryCapacity;
  });
  element("pending-loot-count").textContent =
    `${state.pendingLoot.reduce((total, entry) => total + entry.count, 0)} 件`;
  const rows = state.pendingLoot.map(({ loot, count }) => {
    const row = document.createElement("li");
    row.className = "pending-loot-item";
    row.dataset.rarity = loot.rarity;
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = lootNames[loot.kind];
    const description = document.createElement("span");
    description.textContent = `${loot.rarity === "normal" ? "普通" : loot.rarity === "magic" ? "魔法" : "稀有"} · 等级 ${loot.level}${loot.kind === "tablet-support-skill" ? " · 辅助技能" : loot.kind === "tablet-support-passive" ? " · 辅助被动" : ""}`;
    details.append(name, description);
    const amount = document.createElement("strong");
    amount.textContent = `× ${count}`;
    const actions = document.createElement("div");
    actions.className = "pending-loot-actions";
    for (const [label, requestedCount] of [["打开 1 件", 1], ["尽可能打开", undefined]] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = used >= inventoryCapacity;
      button.title = button.disabled ? "背包已满，请先腾出空位" : label;
      button.addEventListener("click", () => {
        const opened = game.openLoots(loot, requestedCount);
        submitState(opened.player, "validate", `已打开 ${opened.items.length} 件战利品`);
      });
      actions.append(button);
    }
    const chest = assetIcon("pending");
    chest.classList.add("pending-loot-icon");
    row.append(chest, details, amount, actions);
    return row;
  });
  if (rows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "pending-loot-empty";
    empty.textContent = "暂无待领取掉落";
    rows.push(empty);
  }
  element("pending-loot-list").replaceChildren(...rows);
  updateSupportPreview(supportPreview);
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  selectedUuid = undefined;
  renderTablets();
});

let task = game.startBattle(battleSpec);
let battle = new Battle(gameData, task.spec, task.player);
let log = battle.renderLog();
let history: BattleLog[] = [log];
let deaths = 0;
let totalDamage = 0;
let playerPosition = 0;
let timer: number | undefined;
function render(): void {
  gameUI.update(game.getState(), inventoryCapacity);
  renderTablets();
  element("player-state").textContent = JSON.stringify(
    game.getState(),
    null,
    2,
  );
  element("player-combat-profile").textContent = JSON.stringify(
    derivePlayerCombatProfile(gameData, game.getState()),
    (_key, value) => {
      if (value instanceof Set) return [...value];
      if (typeof value === "function")
        return `[Function: ${value.name || "anonymous"}]`;
      return value;
    },
    2,
  );
  const finished = log.status !== "Running";
  const statusLabels = { Running: "战斗中", Victory: "胜利", Defeat: "失败" };
  const player = log.units.find((unit) => unit.kind === "Player");
  playerPosition = player?.position ?? playerPosition;
  element("frame").textContent = String(log.frame);
  element("status").textContent = statusLabels[log.status];
  element("status").dataset.status = log.status;
  element("position").textContent = playerPosition.toFixed(2);
  element("enemies").textContent = String(
    log.units.filter((unit) => unit.kind !== "Player").length,
  );
  element("deaths").textContent = String(deaths);
  const rows = log.units.map((unit) => {
    const row = document.createElement("tr");
    for (const value of [
      unit.id,
      unit.name,
      unit.position.toFixed(2),
      `${unit.hp.toFixed(1)} / ${unit.status.attributes.maxHp.toFixed(1)}`,
      unit.status.attributes.attack.toFixed(1),
      unit.status.attributes.defense.toFixed(1),
    ]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    return row;
  });
  element("units").replaceChildren(...rows);
  const eventRows = log.events.map((event) => {
    const row = document.createElement("tr");
    row.className =
      event.kind === "Damage"
        ? "damage-event"
        : event.kind === "Move"
          ? "move-event"
          : event.kind === "PlayerSkillProgress"
            ? "skill-progress-event"
            : "effect-event";
    const values =
      event.kind === "Damage"
        ? ["Damage", event.dst, `伤害 ${event.damage}`]
        : event.kind === "Move"
          ? [
              "Move",
              event.unit,
              `${event.direction >= 0 ? "→" : "←"} 距离 ${event.distance.toFixed(2)}`,
            ]
          : event.kind === "PlayerSkillProgress"
            ? [
                "PlayerSkillProgress",
                event.uuid,
                `${event.skill} 进度 ${(event.progress * 100).toFixed(1)}% / 施放速率 ${event.castRate}`,
              ]
            : [
                "Effect",
                event.source,
                `${event.skill} / ${event.effect} ${JSON.stringify(event.payload)}`,
              ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    return row;
  });
  element("events").replaceChildren(...eventRows);
  element("event-count").textContent =
    eventRows.length === 0 ? "当前帧无事件" : `当前帧 ${eventRows.length} 条`;
  logs.textContent = history.map((entry) => JSON.stringify(entry)).join("\n");
  logs.scrollTop = logs.scrollHeight;
  step.disabled = log.status !== "Running" || timer !== undefined;
  play.disabled = log.status !== "Running";
  play.textContent = finished
    ? "已结束"
    : timer === undefined
      ? "播放"
      : "暂停";
  speed.disabled = finished;
  element("reset").textContent = finished ? "重新开始" : "重置";
  battlefield.update(log, {
    vision,
    skillNames,
    frameDuration: 1000 / Number(speed.value),
    playing: timer !== undefined,
  });
}

function pause(): void {
  window.clearInterval(timer);
  timer = undefined;
  play.textContent = "播放";
  render();
}

function createBattleResult(settlement: BattleSettlement): BattlefieldResult {
  const rewards: BattlefieldResult["rewards"][number][] = [];
  const rewardKinds = {
    "tablet-skill": "skill",
    "tablet-passive": "passive",
    "tablet-support-skill": "support-skill",
    "tablet-support-passive": "support-passive",
  } as const;
  for (const item of settlement.items) {
    const kind = rewardKinds[item.kind];
    const reward = rewards.find((entry) => entry.kind === kind);
    if (reward) reward.count += 1;
    else rewards.push({ kind, count: 1 });
  }
  if (settlement.pendingLoot.length > 0) {
    rewards.push({ kind: "pending", count: settlement.pendingLoot.length });
  }
  return {
    outcome: log.status === "Victory" ? "Victory" : "Defeat",
    xpGain: settlement.xpGain,
    rewards,
  };
}

function advance(): void {
  if (log.status !== "Running") return;
  const previous = log;
  log = battle.executeFrame();
  tabletMessage.textContent = "当前石板已生效，可继续修改。";
  const ids = new Set(log.units.map((unit) => unit.id));
  deaths += previous.units.filter((unit) => !ids.has(unit.id)).length;
  for (const event of log.events) {
    if (event.kind === "Damage") totalDamage += event.damage;
  }
  history.push(log);
  if (history.length > 100) history.shift();
  if (log.status !== "Running") {
    const settlement = game.battleResult({
      uuid: task.uuid,
      result: log.status,
      frame: log.frame,
    });
    const battleResult = createBattleResult(settlement);
    const outcome = log.status === "Victory" ? "胜利" : "失败";
    resetBattle();
    battlefield.showBattleResult(battleResult);
    tabletMessage.textContent = `上一场${outcome}，已自动开始第 ${round} 场。`;
  }
  render();
}

function start(): void {
  if (log.status !== "Running" || timer !== undefined) return;
  timer = window.setInterval(advance, 1000 / Number(speed.value));
  play.textContent = "暂停";
  render();
}

function resetBattle(): void {
  tabletMessage.textContent = "当前石板已生效，可继续修改。";
  battlefield.reset(!game.battle);
  if (!game.battle) {
    round += 1;
    task = game.startBattle({
      ...battleSpec,
      seed: battleSpec.seed + round - 1,
    });
  }
  battle = new Battle(gameData, task.spec, game.getState());
  log = battle.renderLog();
  history = [log];
  deaths = 0;
  totalDamage = 0;
  playerPosition = 0;
}

play.addEventListener("click", () => (timer === undefined ? start() : pause()));
step.addEventListener("click", advance);
element("reset").addEventListener("click", () => {
  pause();
  resetBattle();
  render();
});
speed.addEventListener("change", () => {
  if (timer !== undefined) {
    pause();
    start();
  }
});
const tabs = ["events", "units", "logs", "build", "combat-profile"];
function selectTab(selected: string): void {
  for (const name of tabs) {
    const active = name === selected;
    const tab = element<HTMLButtonElement>(`tab-${name}`);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    element(`panel-${name}`).hidden = !active;
  }
  if (selected === "logs") logs.scrollTop = logs.scrollHeight;
}
for (const [index, name] of tabs.entries()) {
  const tab = element<HTMLButtonElement>(`tab-${name}`);
  tab.addEventListener("click", () => selectTab(name));
  tab.addEventListener("keydown", (event) => {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (index + tabs.length - 1) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextName = tabs[next]!;
    selectTab(nextName);
    element<HTMLButtonElement>(`tab-${nextName}`).focus();
  });
}
render();
