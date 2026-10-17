import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Attribute, Battle } from "../packages/core/dist/index.js";
import {
  createTablet,
  gameData,
  playerState,
} from "../packages/mock-data/dist/index.js";

// Run via pnpm benchmark:fireball, or after building:
// node scripts/benchmark-fireball.mjs --counts=0,100,500,1000,2000
//   --flight-frames=1,5,10 --frames=1000 --warmup=300 --rounds=5
//   --output=/tmp/fireball-benchmark.json
// A stationary player equips a fireball tablet and casts through SkillTrigger.
// Three stationary enemies share position (60, 0): initial flight takes flightFrames,
// followed by two one-frame bounces. Counts refer to initial casts, not segments.
// Real fireball damage, ignite, scheduler and logs are included.
// Each round uses a fresh process; no forced GC or retained BattleLog history.
const options = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const match = /^--([\w-]+)=(.+)$/.exec(argument);
    if (!match) throw new Error(`Expected --name=value, got ${argument}`);
    return [match[1], match[2]];
  }),
);
const allowed = new Set([
  "counts",
  "flight-frames",
  "frames",
  "warmup",
  "rounds",
  "output",
  "worker",
]);
for (const key of Object.keys(options)) {
  if (!allowed.has(key)) throw new Error(`Unknown option: --${key}`);
}
function integer(value, minimum = 1) {
  const number = Number(value);
  assert.ok(
    Number.isSafeInteger(number) && number >= minimum,
    `Invalid integer: ${value}`,
  );
  return number;
}
function list(value, minimum = 1) {
  return [...new Set(value.split(",").map((entry) => integer(entry, minimum)))];
}
function createBattle(count, flightFrames) {
  const data = {
    ...gameData,
    config: {
      // Zero height keeps all targets at y=0 for deterministic flight times.
      map: {
        spawnMinimumSize: 60,
        visionRange: { left: 0, right: 120, top: 0, bottom: 0 },
      },
      event: gameData.config.event,
    },
    playerDefinition: {
      ...gameData.playerDefinition,
      skills: {
        fireball: {
          uuid: "benchmark-fireball",
          skill: "fireball",
          castRate: count,
          params: {
            damage: 100,
            projectileSpeed: 60 / flightFrames,
            bounce: 3,
            range: 60,
          },
        },
      },
      baseStatus: {
        attributes: Attribute.createDictByRaw({ maxHp: 1e15, speed: 0 }),
        triggers: {},
      },
    },
    unitDefinitions: {
      BenchmarkTarget: {
        kind: "BenchmarkTarget",
        name: "Benchmark target",
        status: { attributes: { maxHp: 1e15, speed: 0 } },
        skills: {},
      },
    },
    mapDefinitions: {
      benchmark: {
        name: "Benchmark",
        background: "forest",
        xp: 0,
        totalValue: 1,
        spawner: [
          {
            mapSize: 0,
            value: 1,
            weight: 1,
            enemies: [{ kind: "BenchmarkTarget", count: { min: 3, max: 3 } }],
          },
        ],
      },
    },
  };
  const state = {
    ...structuredClone(playerState),
    tablets: playerState.tablets.map(() => null),
  };
  state.tablets[0] = createTablet("fireball", 0);
  return {
    battle: new Battle(
      data,
      { level: [1, 1], seed: 42, map: "benchmark" },
      state,
    ),
    state,
  };
}
function verify(
  log,
  count,
  flightFrames,
  emissionFrames,
  previousHp,
  totalHits,
) {
  assert.equal(log.status, "Running");
  assert.equal(log.units.length, 4);
  assert.ok(log.units.every((unit) => unit.hp > 0));
  const player = log.units.find((unit) => unit.kind === "Player");
  assert.deepEqual(player.position, { x: 0, y: 0 });
  assert.equal(player.hp, 1e15);
  const targets = log.units.filter((unit) => unit.kind === "BenchmarkTarget");
  assert.equal(targets.length, 3);
  const delays = [flightFrames, flightFrames + 1, flightFrames + 2];
  const hitsAt = (delay) =>
    log.frame > delay && log.frame <= emissionFrames + delay ? count : 0;
  const expectedHits = delays.reduce((sum, delay) => sum + hitsAt(delay), 0);
  const expectedIgnite = delays.reduce((sum, delay) => {
    const first = Math.max(log.frame - 20, delay + 1);
    const last = Math.min(log.frame - 1, emissionFrames + delay);
    return sum + count * Math.max(0, last - first + 1);
  }, 0);
  let actualHits = 0;
  let actualIgnite = 0;
  for (const target of targets) {
    assert.deepEqual(target.position, { x: 60, y: 0 });
    // Damage=100 makes each ignite stack exactly 1, avoiding rounding at high HP.
    const ignite = target.status.attributes["buff.ignite"] ?? 0;
    const damage = (previousHp.get(target.id) ?? 1e15) - target.hp;
    const hits = (damage - ignite) / 100;
    assert.ok(Number.isSafeInteger(hits) && hits >= 0);
    actualHits += hits;
    actualIgnite += ignite;
    totalHits.set(target.id, (totalHits.get(target.id) ?? 0) + hits);
    previousHp.set(target.id, target.hp);
    const damageEvents = log.events.filter(
      (event) => event.kind === "Damage" && event.dst === target.id,
    ).length;
    assert.equal(
      damageEvents,
      Math.min(
        hits + (ignite > 0 ? 1 : 0),
        gameData.config.event.maxEventPerUnit.damage,
      ),
    );
  }
  assert.equal(
    actualHits,
    expectedHits,
    `Incorrect impacts at frame ${log.frame}`,
  );
  assert.equal(
    actualIgnite,
    expectedIgnite,
    `Incorrect ignite at frame ${log.frame}`,
  );
  const initialCasts = log.frame <= emissionFrames ? count : 0;
  const submissions = initialCasts + hitsAt(delays[0]) + hitsAt(delays[1]);
  const effects = log.events.filter((event) => event.kind === "Effect");
  assert.equal(
    effects.length,
    Math.min(submissions, gameData.config.event.maxEventPerUnit.effect),
  );
  for (const event of effects) {
    assert.equal(event.effect, "fireball");
    assert.equal(event.source, player.id);
    assert.ok(targets.some((unit) => unit.id === event.payload.to));
  }
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (p) =>
    sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  return {
    mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted.at(-1),
    over16_67Percent:
      (samples.filter((value) => value > 16.67).length / samples.length) * 100,
  };
}
if (options.worker) {
  const { count, flightFrames, frames, warmup } = JSON.parse(options.worker);
  const { battle, state } = createBattle(count, flightFrames);
  const emissionFrames = warmup + frames;
  const previousHp = new Map();
  const totalHits = new Map();
  const validate = (log) => {
    verify(log, count, flightFrames, emissionFrames, previousHp, totalHits);
  };
  // Fill both the in-flight task population and the 20-frame ignite window.
  for (let frame = 0; frame < warmup; frame++) validate(battle.executeFrame());
  const samples = new Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    const start = performance.now();
    const log = battle.executeFrame();
    samples[frame] = performance.now() - start;
    // Validation and output are outside the timed region.
    validate(log);
  }
  // Unequip the tablet and drain the last chains and their ignite stacks.
  battle.changeState({ ...state, tablets: state.tablets.map(() => null) });
  for (let frame = 0; frame < flightFrames + 23; frame++)
    validate(battle.executeFrame());
  assert.equal(totalHits.size, 3);
  for (const hits of totalHits.values())
    assert.equal(hits, emissionFrames * count);
  process.stdout.write(JSON.stringify(samples));
} else {
  const counts = list(options.counts ?? "0,100,500,1000,2000", 0);
  if (!counts.includes(0)) counts.unshift(0);
  const flights = list(options["flight-frames"] ?? "1,5,10");
  const frames = integer(options.frames ?? 1000);
  const warmup = Math.max(
    integer(options.warmup ?? 300, 0),
    Math.max(...flights) + 23,
  );
  const rounds = integer(options.rounds ?? 5);
  const scenarios = counts.flatMap((count) =>
    (count === 0 ? [1] : flights).map((flightFrames) => ({
      count,
      flightFrames,
    })),
  );
  const report = {
    environment: {
      date: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0]?.model,
      logicalCpus: os.cpus().length,
    },
    config: {
      counts,
      flights,
      frames,
      warmup,
      rounds,
      timeUnit: "ms",
      caster: "Player",
      extraBounces: 2,
      targets: 3,
      targetPositions: Array.from({ length: 3 }, () => ({ x: 60, y: 0 })),
      flightFramesMeaning: "initial flight; each bounce takes one frame",
      eventCaps: gameData.config.event.maxEventPerUnit,
    },
    results: [],
  };
  for (const scenario of scenarios) {
    const samples = [];
    const roundStats = [];
    for (let round = 0; round < rounds; round++) {
      const worker = spawnSync(
        process.execPath,
        [
          fileURLToPath(import.meta.url),
          `--worker=${JSON.stringify({ ...scenario, frames, warmup })}`,
        ],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      );
      if (worker.error) throw worker.error;
      if (worker.status !== 0)
        throw new Error(
          worker.stderr ||
            `Worker exited: ${worker.status}, signal: ${worker.signal}`,
        );
      const timings = JSON.parse(worker.stdout);
      assert.equal(timings.length, frames);
      samples.push(...timings);
      roundStats.push(summarize(timings));
    }
    const result = {
      ...scenario,
      steadyInFlight: scenario.count * (scenario.flightFrames + 2),
      steadyHitsPerFrame: scenario.count * 3,
      ...summarize(samples),
      roundStats,
      samples,
    };
    report.results.push(result);
    console.log(
      `${scenario.count}/frame, flight=${scenario.flightFrames}: mean=${result.mean.toFixed(3)}ms, P95=${result.p95.toFixed(3)}ms`,
    );
  }
  console.table(
    report.results.map(
      ({
        count,
        flightFrames,
        steadyInFlight,
        roundStats,
        samples,
        ...stats
      }) => ({
        "fireballs/frame": count,
        flightFrames,
        steadyInFlight,
        ...Object.fromEntries(
          Object.entries(stats).map(([key, value]) => [key, value.toFixed(3)]),
        ),
      }),
    ),
  );
  console.log(
    JSON.stringify(
      { environment: report.environment, config: report.config },
      null,
      2,
    ),
  );
  if (options.output) {
    writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Raw samples and round statistics: ${options.output}`);
  }
}
