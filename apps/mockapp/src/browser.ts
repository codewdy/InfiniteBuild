import { Battle } from "@infinite-build/core";
import type { BattleLog } from "@infinite-build/core";
import { battleSpec, gameData, playerState } from "@infinite-build/mock-data";

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing element: ${id}`);
  return result as T;
}

const canvas = element<HTMLCanvasElement>("battlefield");
const play = element<HTMLButtonElement>("play");
const step = element<HTMLButtonElement>("step");
const speed = element<HTMLSelectElement>("speed");
const logs = element<HTMLPreElement>("logs");
const vision = gameData.config.map.visionRange;
const range = playerState.move.range;
let battle = new Battle({ gameData, playerState }, battleSpec);
let log = battle.renderLog();
let history: BattleLog[] = [log];
let deaths = 0;
let timer: number | undefined;

element("config").textContent = `Seed ${battleSpec.seed} · 视野 ${vision} · 范围 ${range} · 目标 ${playerState.move.count}`;

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
  const origin = player?.position ?? 0;
  const left = 48;
  const right = width - 38;
  const span = vision + 4;
  const x = (position: number) => left + ((position - origin + 2) / span) * (right - left);
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
    const y = unit.kind === "Player" ? 155 : 90 + (index % 4) * 35;
    context.fillStyle = unit.kind === "Player" ? "#79b8ff" : unit.kind === "Slime" ? "#72dab5" : "#f5ba79";
    context.beginPath();
    context.arc(at, y, unit.kind === "Player" ? 10 : 7, 0, Math.PI * 2);
    context.fill();
    context.textAlign = "center";
    context.fillText(`${unit.kind} #${unit.id}`, at, y - 16);
    context.textAlign = "left";
  });
  const previousUnits = history[history.length - 2]?.units ?? [];
  const damageByUnit = new Map<number, number>();
  for (const event of log.events) {
    if (event.kind === "Damage") {
      damageByUnit.set(event.dst, (damageByUnit.get(event.dst) ?? 0) + event.damage);
      continue;
    }
    if (event.distance === 0 || event.direction === 0) continue;
    const index = log.units.findIndex((unit) => unit.id === event.unit);
    const unit = log.units[index] ?? previousUnits.find((unit) => unit.id === event.unit);
    if (!unit) continue;
    const y = (unit.kind === "Player" ? 155 : 90 + (Math.max(index, 0) % 4) * 35) + 12;
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
    const y = unit.kind === "Player" ? 155 : 90 + (Math.max(displayIndex, 0) % 4) * 35;
    context.strokeStyle = "#ff7b89";
    context.beginPath();
    context.arc(x(unit.position), y, 13, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#ff7b89";
    context.font = "bold 13px system-ui";
    context.textAlign = "center";
    context.fillText(`-${damage}${index < 0 ? " · 死亡" : ""}`, x(unit.position), y + 29);
    context.textAlign = "left";
  }
}

function render(): void {
  element("frame").textContent = String(log.frame);
  element("status").textContent = log.status;
  element("position").textContent = (log.units.find((unit) => unit.kind === "Player")?.position ?? 0).toFixed(2);
  element("enemies").textContent = String(log.units.filter((unit) => unit.kind !== "Player").length);
  element("deaths").textContent = String(deaths);
  const rows = log.units.map((unit) => {
    const row = document.createElement("tr");
    for (const value of [unit.id, unit.kind, unit.position.toFixed(2)]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    return row;
  });
  element("units").replaceChildren(...rows);
  const eventRows = log.events.map((event) => {
    const row = document.createElement("tr");
    row.className = event.kind === "Damage" ? "damage-event" : "move-event";
    const values = event.kind === "Damage"
      ? ["Damage", event.dst, `伤害 ${event.damage}`]
      : ["Move", event.unit, `${event.direction >= 0 ? "→" : "←"} 距离 ${event.distance.toFixed(2)}`];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    return row;
  });
  element("events").replaceChildren(...eventRows);
  element("event-count").textContent = eventRows.length === 0 ? "当前帧无事件" : `当前帧 ${eventRows.length} 条`;
  logs.textContent = history.map((entry) => JSON.stringify(entry)).join("\n");
  logs.scrollTop = logs.scrollHeight;
  step.disabled = log.status !== "Running" || timer !== undefined;
  play.disabled = log.status !== "Running";
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
  const ids = new Set(log.units.map((unit) => unit.id));
  deaths += previous.units.filter((unit) => !ids.has(unit.id)).length;
  history.push(log);
  if (history.length > 100) history.shift();
  if (log.status !== "Running") pause();
  render();
}

function start(): void {
  timer = window.setInterval(advance, 1000 / Number(speed.value));
  play.textContent = "暂停";
  render();
}

play.addEventListener("click", () => timer === undefined ? start() : pause());
step.addEventListener("click", advance);
element("reset").addEventListener("click", () => {
  pause();
  battle = new Battle({ gameData, playerState }, battleSpec);
  log = battle.renderLog();
  history = [log];
  deaths = 0;
  render();
});
speed.addEventListener("change", () => {
  if (timer !== undefined) {
    pause();
    start();
  }
});
window.addEventListener("resize", draw);
render();
