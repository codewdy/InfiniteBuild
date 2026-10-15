import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Attribute, Battle } from "../packages/core/dist/index.js";
import { gameData, playerState } from "../packages/mock-data/dist/index.js";

// Run via pnpm benchmark:fireball, or after building:
// node scripts/benchmark-fireball.mjs --counts=0,100,500,1000,2000
//   --flight-frames=1,10,60 --frames=1000 --warmup=300 --rounds=5
//   --output=/tmp/fireball-benchmark.json
// One stationary enemy casts at a stationary player through the normal
// SkillTrigger. Real fireball damage, ignite, scheduler and logs are included.
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
      map: { spawnMinimumSize: 60, visionRange: 120 },
      event: gameData.config.event,
    },
    playerDefinition: {
      ...gameData.playerDefinition,
      baseStatus: {
        attributes: Attribute.createDictByRaw({ maxHp: 1e15, speed: 0 }),
        triggers: {},
      },
    },
    unitDefinitions: {
      BenchmarkCaster: {
        kind: "BenchmarkCaster",
        name: "Benchmark caster",
        status: { attributes: { maxHp: 1e15, speed: 0 } },
        skills: {
          onUpdate: [
            {
              skill: "fireball",
              uuid: "benchmark-fireball",
              castRate: count,
              params: {
                damage: 100,
                range: 120,
                projectileSpeed: 60 / flightFrames,
              },
            },
          ],
        },
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
            enemies: [{ kind: "BenchmarkCaster", count: { min: 1, max: 1 } }],
          },
        ],
      },
    },
  };
  return new Battle(
    data,
    { level: [1, 1], seed: 42, map: "benchmark" },
    {
      ...structuredClone(playerState),
      tablets: playerState.tablets.map(() => null),
    },
  );
}
function verify(log, count, flightFrames, previousHp) {
  assert.equal(log.status, "Running");
  assert.equal(log.units.length, 2);
  assert.ok(log.units.every((unit) => unit.hp > 0));
  assert.equal(log.units.find((unit) => unit.kind === "Player").position, 0);
  assert.equal(
    log.units.find((unit) => unit.kind === "BenchmarkCaster").position,
    60,
  );
  let effects = 0;
  let damage = 0;
  for (const event of log.events) {
    if (event.kind === "Effect") {
      assert.equal(event.effect, "fireball");
      effects++;
    }
    if (event.kind === "Damage") damage++;
  }
  assert.equal(
    effects,
    Math.min(count, gameData.config.event.maxEventPerUnit.effect),
    `Incorrect fireball event count at frame ${log.frame}`,
  );
  const hits = log.frame > flightFrames ? count : 0;
  const ignite = count > 0 && log.frame > flightFrames + 1 ? 1 : 0;
  assert.equal(
    damage,
    Math.min(hits + ignite, gameData.config.event.maxEventPerUnit.damage),
    `Incorrect impact/ignite event count at frame ${log.frame}`,
  );
  // Damage=100 makes each ignite stack exactly 1, avoiding rounding at high HP.
  // HP and buff levels validate real impacts even when event logs are capped.
  const target = log.units.find((unit) => unit.kind === "Player");
  const igniteDamage =
    count * Math.min(20, Math.max(0, log.frame - flightFrames - 1));
  assert.equal(target.status.attributes["buff.ignite"] ?? 0, igniteDamage);
  assert.equal(
    previousHp - target.hp,
    hits * 100 + igniteDamage,
    `Incorrect actual damage at frame ${log.frame}`,
  );
  return target.hp;
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
  const battle = createBattle(count, flightFrames);
  let previousHp = 1e15;
  const validate = (log) => {
    previousHp = verify(log, count, flightFrames, previousHp);
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
  // Verify impacts from the final measured launches as well.
  for (let frame = 0; frame < flightFrames; frame++)
    validate(battle.executeFrame());
  process.stdout.write(JSON.stringify(samples));
} else {
  const counts = list(options.counts ?? "0,100,500,1000,2000", 0);
  if (!counts.includes(0)) counts.unshift(0);
  const flights = list(options["flight-frames"] ?? "1,10,60");
  const frames = integer(options.frames ?? 1000);
  const warmup = Math.max(
    integer(options.warmup ?? 300, 0),
    Math.max(...flights) + 21,
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
      steadyInFlight: scenario.count * scenario.flightFrames,
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
