import { Battle, TabletMap, inferPlayerStatus } from "@infinite-build/core";
import type { BattleEvent, BattleLog } from "@infinite-build/core";
import { battleSpec, gameData, playerBuild, createTablet, tabletOptions } from "@infinite-build/mock-data";
import type { MockTablet, TabletKind } from "@infinite-build/mock-data";

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing element: ${id}`);
  return result as T;
}

const canvas = element<HTMLCanvasElement>("battlefield");
const play = element<HTMLButtonElement>("play");
const step = element<HTMLButtonElement>("step");
const speed = element<HTMLSelectElement>("speed");
const tabletBoard = element<HTMLDivElement>("tablet-board");
const tabletMessage = element<HTMLParagraphElement>("tablet-message");
const logs = element<HTMLPreElement>("logs");
const vision = gameData.config.map.visionRange;
const range = playerBuild.move.range;
const selectedTablets = playerBuild.tablets.map((tablet) => tablet as MockTablet | undefined);
for (const row of TabletMap.pos2Id) {
  for (const id of row) {
    const label = document.createElement("label");
    label.className = "tablet-slot";
    const title = document.createElement("span");
    title.textContent = `槽位 ${id}`;
    const select = document.createElement("select");
    select.setAttribute("aria-label", `槽位 ${id} 的石板`);
    select.dataset.slot = String(id);
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "空槽位";
    select.append(empty);
    for (const option of tabletOptions) {
      const entry = document.createElement("option");
      entry.value = option.kind;
      entry.textContent = option.name;
      select.append(entry);
    }
    select.value = selectedTablets[id]?.kind ?? "";
    label.append(title, select);
    tabletBoard.append(label);
    select.addEventListener("change", () => {
      const kind = select.value as TabletKind | "";
      selectedTablets[id] = kind ? createTablet(kind, id) : undefined;
      if (log.status === "Running") {
        battle.changeBuild(selectedBuild());
        tabletMessage.textContent = "石板已修改，下一帧生效。";
      } else {
        tabletMessage.textContent = "石板已修改，点击重新开始使用新构筑。";
      }
      render();
    });
  }
}

function selectedBuild() {
  return { ...playerBuild, tablets: [...selectedTablets] };
}

let runningSkills = inferPlayerStatus(selectedBuild()).skills.onUpdate ?? [];
const skillProgress = new Map<string, number>();
let battle = new Battle(gameData, battleSpec, selectedBuild());
let log = battle.renderLog();
let history: BattleLog[] = [log];
let deaths = 0;
let totalDamage = 0;
let playerPosition = 0;
let timer: number | undefined;
type VisualEffect = {
  startFrame: number;
  durationFrames: number;
} & (
  | {
      kind: "fireball";
      from: number;
      to: number;
      fromY: number;
      targetPosition: number;
      targetY: number;
    }
  | { kind: "nova"; center: number; radius: number; y: number }
);
let effects: VisualEffect[] = [];

function unitY(unit: BattleLog["units"][number], index: number): number {
  return unit.kind === "Player" ? 155 : 90 + (index % 4) * 35;
}

function addVisualEffect(event: BattleEvent.Effect, previous: BattleLog): void {
  const { durationFrames, from, to, center, radius } = event.payload;
  if (
    typeof durationFrames !== "number" ||
    !Number.isFinite(durationFrames) ||
    durationFrames <= 0
  )
    return;
  const timing = {
    startFrame: log.frame,
    durationFrames,
  };
  const sourceIndex = previous.units.findIndex(
    (unit) => unit.id === event.source,
  );
  const source = previous.units[sourceIndex];
  const y = source ? unitY(source, sourceIndex) : 155;
  if (
    event.effect === "fireball" &&
    typeof from === "number" &&
    Number.isFinite(from) &&
    typeof to === "number" &&
    Number.isSafeInteger(to)
  ) {
    const units = log.units.some((unit) => unit.id === to)
      ? log.units
      : previous.units;
    const targetIndex = units.findIndex((unit) => unit.id === to);
    const target = units[targetIndex];
    if (!target) return;
    effects.push({
      ...timing,
      kind: "fireball",
      from,
      to,
      fromY: y,
      targetPosition: target.position,
      targetY: unitY(target, targetIndex),
    });
  } else if (
    event.effect === "nova" &&
    typeof center === "number" &&
    Number.isFinite(center) &&
    typeof radius === "number" &&
    Number.isFinite(radius) &&
    radius >= 0
  ) {
    effects.push({ ...timing, kind: "nova", center, radius, y });
  }
}

element("config").textContent =
  `Seed ${battleSpec.seed} · 视野 ${vision} · 范围 ${range} · 目标 ${playerBuild.move.count}`;

function draw(): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.scale(ratio, ratio);
  const player = log.units.find((unit) => unit.kind === "Player");
  const origin = player?.position ?? playerPosition;
  const left = 48;
  const right = width - 38;
  const span = vision + 4;
  const x = (position: number) =>
    left + ((position - origin + 2) / span) * (right - left);
  context.fillStyle = "#101929";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#192e47";
  context.fillRect(x(origin), 35, x(origin + vision) - x(origin), 205);
  context.fillStyle = "#1e443f";
  context.fillRect(x(origin), 35, x(origin + range) - x(origin), 205);
  context.font = "11px system-ui";
  context.fillStyle = "#96b6cd";
  context.fillText("移动范围", x(origin) + 8, 53);
  context.fillText("视野", x(origin + vision) - 32, 53);
  for (let offset = 0; offset <= vision; offset += 5) {
    const at = x(origin + offset);
    context.strokeStyle = "#30405a";
    context.beginPath();
    context.moveTo(at, 65);
    context.lineTo(at, 245);
    context.stroke();
    context.fillStyle = "#8498b2";
    context.fillText((origin + offset).toFixed(1), at - 10, 265);
  }
  log.units.forEach((unit, index) => {
    const at = x(unit.position);
    const y = unitY(unit, index);
    context.fillStyle =
      unit.kind === "Player"
        ? "#79b8ff"
        : unit.kind === "Slime"
          ? "#72dab5"
          : "#f5ba79";
    context.beginPath();
    context.arc(at, y, unit.kind === "Player" ? 10 : 7, 0, Math.PI * 2);
    context.fill();
    context.textAlign = "center";
    context.fillText(`${unit.kind} #${unit.id}`, at, y - 16);
    const healthRatio =
      unit.status.attributes.maxHp > 0
        ? Math.max(0, Math.min(1, unit.hp / unit.status.attributes.maxHp))
        : 0;
    context.fillStyle = "#30405a";
    context.fillRect(at - 16, y - 11, 32, 3);
    context.fillStyle = healthRatio <= 0.3 ? "#ff7b89" : "#72dab5";
    context.fillRect(at - 16, y - 11, 32 * healthRatio, 3);
    context.textAlign = "left";
  });
  const previousUnits = history[history.length - 2]?.units ?? [];
  // Effects keep their world positions even as the player's viewport moves.
  context.save();
  context.beginPath();
  context.rect(left, 65, right - left, 180);
  context.clip();
  for (const effect of effects) {
    const progress = Math.max(
      0,
      Math.min(1, (log.frame - effect.startFrame) / effect.durationFrames),
    );
    context.globalAlpha = 1 - progress * 0.5;
    if (effect.kind === "fireball") {
      const units = log.units.some((unit) => unit.id === effect.to)
        ? log.units
        : previousUnits;
      const targetIndex = units.findIndex((unit) => unit.id === effect.to);
      const target = units[targetIndex];
      if (target) {
        effect.targetPosition = target.position;
        effect.targetY = unitY(target, targetIndex);
      }
      const at = x(
        effect.from + (effect.targetPosition - effect.from) * progress,
      );
      const y = effect.fromY + (effect.targetY - effect.fromY) * progress;
      const tailProgress = Math.max(0, progress - 0.18);
      context.strokeStyle = "#ff963e";
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(
        x(effect.from + (effect.targetPosition - effect.from) * tailProgress),
        effect.fromY + (effect.targetY - effect.fromY) * tailProgress,
      );
      context.lineTo(at, y);
      context.stroke();
      const angle = Math.atan2(
        effect.targetY - effect.fromY,
        x(effect.targetPosition) - x(effect.from),
      );
      context.save();
      context.translate(at, y);
      context.rotate(angle);
      context.shadowColor = "#ff963e";
      context.shadowBlur = 16;
      context.fillStyle = "#ff963e";
      context.beginPath();
      context.moveTo(11, 0);
      context.bezierCurveTo(7, -9, -3, -9, -15, 0);
      context.bezierCurveTo(-3, 9, 7, 9, 11, 0);
      context.closePath();
      context.fill();
      context.fillStyle = "#ffe6a3";
      context.beginPath();
      context.ellipse(3, 0, 6, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    } else {
      const waveRadius = effect.radius * progress;
      const radius = Math.abs(x(effect.center + waveRadius) - x(effect.center));
      context.globalAlpha = 0.85;
      context.strokeStyle = "#c49bff";
      context.fillStyle = "#b18aff";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x(effect.center), effect.y, radius, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 0.08;
      context.fill();
    }
  }
  context.restore();
  const damageByUnit = new Map<number, number>();
  for (const event of log.events) {
    if (event.kind === "Damage") {
      damageByUnit.set(
        event.dst,
        (damageByUnit.get(event.dst) ?? 0) + event.damage,
      );
      continue;
    }
    if (event.kind !== "Move") continue;
    if (event.distance === 0 || event.direction === 0) continue;
    const index = log.units.findIndex((unit) => unit.id === event.unit);
    const unit =
      log.units[index] ?? previousUnits.find((unit) => unit.id === event.unit);
    if (!unit) continue;
    const y =
      (unit.kind === "Player" ? 155 : 90 + (Math.max(index, 0) % 4) * 35) + 12;
    const start = x(unit.position - event.direction * event.distance);
    const end = x(unit.position);
    const direction = Math.sign(event.direction * event.distance);
    context.strokeStyle = "#79b8ff";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(start, y);
    context.lineTo(end, y);
    context.moveTo(end - direction * 5, y - 4);
    context.lineTo(end, y);
    context.lineTo(end - direction * 5, y + 4);
    context.stroke();
    context.lineWidth = 1;
  }
  for (const [id, damage] of damageByUnit) {
    const index = log.units.findIndex((unit) => unit.id === id);
    const previousIndex = previousUnits.findIndex((unit) => unit.id === id);
    const unit = log.units[index] ?? previousUnits[previousIndex];
    if (!unit) continue;
    const displayIndex = index >= 0 ? index : previousIndex;
    const y =
      unit.kind === "Player" ? 155 : 90 + (Math.max(displayIndex, 0) % 4) * 35;
    context.strokeStyle = "#ff7b89";
    context.beginPath();
    context.arc(x(unit.position), y, 13, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#ff7b89";
    context.font = "bold 13px system-ui";
    context.textAlign = "center";
    context.fillText(
      `-${damage}${index < 0 ? " · 死亡" : ""}`,
      x(unit.position),
      y + 29,
    );
    context.textAlign = "left";
  }
}

function render(): void {
  const progressRows = runningSkills.map((entry) => {
    const row = document.createElement("div");
    row.className = "skill-progress-row";
    const name = document.createElement("span");
    const definition = gameData.skillDefinitions[entry.skill]!;
    const skillName = definition.name;
    name.textContent = skillName;
    const description = definition.description?.(entry.params);
    if (description) row.title = description;
    const progress = Math.max(
      0,
      Math.min(1, skillProgress.get(entry.uuid) ?? 0),
    );
    const pie = document.createElement("span");
    pie.className = "skill-progress-pie";
    pie.style.setProperty("--progress", `${progress * 360}deg`);
    pie.setAttribute("role", "progressbar");
    pie.setAttribute("aria-label", `${skillName}施放进度`);
    pie.setAttribute("aria-valuemin", "0");
    pie.setAttribute("aria-valuemax", "100");
    pie.setAttribute("aria-valuenow", (progress * 100).toFixed(1));
    row.append(name, pie);
    return row;
  });
  element("skill-progress-list").replaceChildren(...progressRows);
  element("player-build").textContent = JSON.stringify(
    {
      ...selectedBuild(),
      tablets: selectedTablets.map((tablet) => tablet
        ? { kind: tablet.kind, slot: tablet.slot, name: tablet.name }
        : null),
      skills: {
        onUpdate: (inferPlayerStatus(selectedBuild()).skills.onUpdate ?? []).map((entry) => ({
          ...entry,
          description: gameData.skillDefinitions[entry.skill]!.description?.(entry.params),
        })),
      },
    },
    null,
    2,
  );
  const finished = log.status !== "Running";
  const statusLabels = { Running: "战斗中", Victory: "胜利", Defeat: "失败" };
  const player = log.units.find((unit) => unit.kind === "Player");
  playerPosition = player?.position ?? playerPosition;
  element("frame").textContent = String(log.frame);
  element("status").textContent = statusLabels[log.status];
  element("status").dataset.status = log.status;
  const result = element("result");
  result.hidden = !finished;
  result.dataset.status = log.status;
  element("result-title").textContent =
    log.status === "Victory" ? "战斗胜利" : "战斗失败";
  element("result-detail").textContent =
    `${log.status === "Victory" ? "所有敌人已清除。" : "玩家已死亡。"}结束于第 ${log.frame} 帧 · 累计死亡 ${deaths} · 累计伤害 ${totalDamage}`;
  element("position").textContent = playerPosition.toFixed(2);
  element("enemies").textContent = String(
    log.units.filter((unit) => unit.kind !== "Player").length,
  );
  element("deaths").textContent = String(deaths);
  const rows = log.units.map((unit) => {
    const row = document.createElement("tr");
    for (const value of [
      unit.id,
      unit.kind,
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
  draw();
}

function pause(): void {
  window.clearInterval(timer);
  timer = undefined;
  play.textContent = "播放";
  render();
}

function advance(): void {
  if (log.status !== "Running") return;
  const previous = log;
  log = battle.executeFrame();
  effects = effects.filter(
    (effect) => log.frame - effect.startFrame <= effect.durationFrames,
  );
  runningSkills = inferPlayerStatus(selectedBuild()).skills.onUpdate ?? [];
  tabletMessage.textContent = "当前石板已生效，可继续修改。";
  const ids = new Set(log.units.map((unit) => unit.id));
  deaths += previous.units.filter((unit) => !ids.has(unit.id)).length;
  for (const event of log.events) {
    if (event.kind === "Damage") totalDamage += event.damage;
    if (event.kind === "Effect") addVisualEffect(event, previous);
    if (event.kind === "PlayerSkillProgress") {
      skillProgress.set(event.uuid, event.progress);
    }
  }
  history.push(log);
  if (history.length > 100) history.shift();
  if (log.status !== "Running") pause();
  render();
}

function start(): void {
  if (log.status !== "Running" || timer !== undefined) return;
  timer = window.setInterval(advance, 1000 / Number(speed.value));
  play.textContent = "暂停";
  render();
}

play.addEventListener("click", () => (timer === undefined ? start() : pause()));
step.addEventListener("click", advance);
element("reset").addEventListener("click", () => {
  pause();
  runningSkills = inferPlayerStatus(selectedBuild()).skills.onUpdate ?? [];
  tabletMessage.textContent = "当前石板已生效，可继续修改。";
  skillProgress.clear();
  effects = [];
  battle = new Battle(gameData, battleSpec, selectedBuild());
  log = battle.renderLog();
  history = [log];
  deaths = 0;
  totalDamage = 0;
  playerPosition = 0;
  render();
});
speed.addEventListener("change", () => {
  if (timer !== undefined) {
    pause();
    start();
  }
});
const tabs = ["events", "units", "logs", "build"];
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
window.addEventListener("resize", draw);
render();
