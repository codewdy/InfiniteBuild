import { Battlefield } from "@infinite-build/renderer";
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
const battlefield = await Battlefield.create(canvas);
window.addEventListener("pagehide", () => battlefield.destroy(), { once: true });
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
  "tablet-support-skill": "技能辅助石板",
  "tablet-support-passive": "被动辅助石板",
};
let round = 1;
function tabletName(tablet: TabletSpec.Tablet): string {
  if (tablet.kind === "passive") return "生命石板";
  if (tablet.kind !== "skill") {
    return tablet.kind === "support-skill" ? "技能急速" : "被动辅助石板";
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
    tablet.kind === "passive"
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
  if (location.area === "tablets") return state.tablets[location.index] ?? null;
  const item = state.inventory[location.index];
  return item?.kind === "tablet" ? item.tablet : null;
}

function setTablet(
  state: PlayerState,
  location: SlotLocation,
  tablet: TabletSpec.Tablet | null,
): void {
  if (location.area === "tablets") state.tablets[location.index] = tablet;
  else
    state.inventory[location.index] = tablet
      ? { kind: "tablet", uuid: tablet.uuid, tablet }
      : null;
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
  state.inventory[empty] = { kind: "tablet", uuid: tablet.uuid, tablet };
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
      kind: "skill",
      uuid: crypto.randomUUID(),
      skill: option.kind,
      rotate: 0,
    };
    addTabletToInventory(state, tablet, `${option.name}已加入背包`);
  });
  element("tablet-add-actions").append(button);
}

const hasteButton = document.createElement("button");
hasteButton.type = "button";
hasteButton.className = "add-tablet";
hasteButton.dataset.skill = "support-skill";
hasteButton.textContent = "＋ 新增技能急速";
hasteButton.title =
  "辅助箭头方向的技能石板，持续施放速率提升(add) 50%。右键旋转方向。";
hasteButton.addEventListener("click", () => {
  const state = game.getState();
  const tablet = createSupportTablet(state.inventory.length);
  tablet.uuid = crypto.randomUUID();
  addTabletToInventory(state, tablet, "技能急速已加入背包");
});
element("tablet-add-actions").append(hasteButton);

const lifeButton = document.createElement("button");
lifeButton.type = "button";
lifeButton.className = "add-tablet";
lifeButton.dataset.skill = "passive";
lifeButton.textContent = "＋ 新增生命石板";
lifeButton.title = "装备后最大生命值 +10。";
lifeButton.addEventListener("click", () => {
  const state = game.getState();
  const tablet = createPassiveTablet(state.inventory.length);
  tablet.uuid = crypto.randomUUID();
  addTabletToInventory(state, tablet, "生命石板已加入背包");
});
element("tablet-add-actions").append(lifeButton);

const passiveRng = new RandomGenerator(
  crypto.getRandomValues(new Uint32Array(1))[0]!,
);
for (const option of passiveTabletOptions) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "add-tablet";
  button.dataset.skill = "passive";
  button.textContent = `＋ ${option.name}被动石板`;
  button.title = `等级 ${option.level} · 随机生成 1–2 条生命词缀，最高 T${option.level === 1 ? 1 : option.level === 20 ? 3 : 5}`;
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
    (hovered?.kind === "skill" || hovered?.kind === "passive")
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
        (hovered.kind === "skill" || hovered.kind === "passive"
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
  slot.dataset.slot = String(location.index);
  slot.dataset.skill =
    tablet?.kind === "skill" ? tablet.skill : (tablet?.kind ?? "empty");
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
    `${label}：${tablet ? tabletName(tablet) : "空槽位"}${sources.length ? `，被槽位 ${sources.join("、")} 辅助` : ""}，点击选择或拖放交换，右键或按 R 顺时针旋转`,
  );
  slot.setAttribute("aria-pressed", slot.dataset.selected);
  slot.title = tablet
    ? `${tabletName(tablet)}\n${tablet.kind === "skill" ? (tabletOptions.find((option) => option.kind === tablet.skill)?.description ?? "") : tablet.affixes.map((affix) => `${affix.id}: ${affix.param}`).join("\n")}\n${tablet.uuid}`
    : `${label} · 拖入石板`;
  if (tablet) {
    slot.title += `\n旋转 ${tablet.rotate}° · 右键或按 R 顺时针旋转`;
    if (tablet.kind !== "skill") {
      slot.title = [
        tabletName(tablet),
        ...tablet.affixes.map((affix) => affixText(tablet, affix)),
        `旋转 ${tablet.rotate}° · 右键或按 R 顺时针旋转`,
        tablet.uuid,
      ].join("\n");
    }
  }
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
  if (tablet?.kind === "skill" && tablet.skill === "fireball") {
    icon.innerHTML =
      '<svg viewBox="0 0 48 48" fill="none"><path d="M27 5c2 10-9 12-5 21 2-5 6-6 8-11 7 6 11 12 8 20-3 10-20 12-26 3C3 25 19 20 17 11c5 3 6 7 6 10 6-5 4-11 4-16Z" fill="currentColor"/><path d="M25 26c0 5-7 7-5 13 2 5 10 3 10-2 0-4-3-7-5-11Z" fill="#fff0bd"/></svg>';
  } else if (
    tablet &&
    (tablet.kind === "support-skill" || tablet.kind === "support-passive")
  ) {
    icon.innerHTML =
      '<svg viewBox="0 0 48 48" fill="none"><path d="m24 5 19 19-19 19L5 24Z" stroke="currentColor" stroke-width="2"/><path d="M12 24h24m-9-9 9 9-9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    icon.style.transform = `rotate(${tablet.rotate}deg)`;
  } else if (tablet) {
    icon.innerHTML =
      '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="17" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="24" r="11" stroke="currentColor" opacity=".45"/><path d="m24 5 5 14 14 5-14 5-5 14-5-14-14-5 14-5Z" fill="currentColor"/><circle cx="24" cy="24" r="4" fill="#f4eaff"/></svg>';
  } else {
    icon.innerHTML =
      '<svg viewBox="0 0 48 48" fill="none"><path d="M24 16v16M16 24h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  }
  const name = document.createElement("span");
  name.className = "slot-name";
  name.textContent = tablet ? tabletName(tablet).replace("石板", "") : "空槽位";
  slot.append(index, icon, name);
  if (tablet?.kind === "passive") {
    const affixes = document.createElement("span");
    affixes.className = "tablet-affixes";
    for (const affix of tablet.affixes) {
      const line = document.createElement("span");
      line.textContent = affixText(tablet, affix);
      affixes.append(line);
    }
    slot.append(affixes);
  }
  if (
    tablet &&
    (tablet.kind === "support-skill" || tablet.kind === "support-passive")
  ) {
    const directions = document.createElement("span");
    directions.className = "support-directions";
    directions.setAttribute("aria-hidden", "true");
    for (const [x, y] of tablet.delta) {
      const [dx, dy] = TabletMap.rotateVec(x, y, tablet.rotate);
      const arrow = document.createElement("span");
      arrow.textContent = dx === 0 && dy === 0 ? "●" : "→";
      arrow.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      directions.append(arrow);
    }
    slot.append(directions);
  }
  if (sources.length) {
    const badge = document.createElement("span");
    badge.className = "support-badge";
    badge.textContent =
      sources.length > 1 ? `辅助 ×${sources.length}` : "被辅助";
    slot.append(badge);
  }
  const rotate = () => {
    if (!tablet || draggingUuid) return;
    const nextState = game.getState();
    const current = tabletAt(nextState, location);
    if (!current || current.uuid !== tablet.uuid) return;
    const rotations = [0, 90, 180, 270] as const;
    current.rotate =
      rotations[(rotations.indexOf(current.rotate) + 1) % rotations.length]!;
    submitState(
      nextState,
      "validate",
      `${tabletName(current)}已旋转至 ${current.rotate}°`,
    );
  };
  slot.addEventListener("contextmenu", (event) => {
    if (!tablet) return;
    event.preventDefault();
    rotate();
  });
  slot.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "r" || !tablet) return;
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
      (tablet.kind !== "support-skill" && tablet.kind !== "support-passive")
    )
      return;
    for (const [x, y] of tablet.delta) {
      const target = TabletMap.move(source, x, y, tablet.rotate);
      const targetKind = tablet.kind === "support-skill" ? "skill" : "passive";
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
    description.textContent = `${loot.rarity === "magic" ? "魔法" : "稀有"} · 等级 ${loot.level}`;
    details.append(name, description);
    const amount = document.createElement("strong");
    amount.textContent = `× ${count}`;
    row.append(details, amount);
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
  for (const item of settlement.items) {
    const kind = item.tablet.kind;
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
