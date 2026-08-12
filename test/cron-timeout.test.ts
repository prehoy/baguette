import { expect, test } from "bun:test";
import { memoryLock, runCronJob, type CronDefinition } from "../src/cron";

// A job whose process() never settles — the hang that froze cron until restart.
const hungJob = (name: string, timeoutMs?: number): CronDefinition => ({
  details: { name, cron: { value: "* * * * *" }, timeoutMs },
  process: () => new Promise<never>(() => {}), // never resolves
});

const fastJob = (name: string, onRun: () => void, timeoutMs?: number): CronDefinition => ({
  details: { name, cron: { value: "* * * * *" }, timeoutMs },
  process: async () => (onRun(), "ok"),
});

test("a hung process() times out instead of hanging forever", async () => {
  const start = Date.now();
  await runCronJob(hungJob("hang", 50), {}); // no lock — just the timeout race
  // If the timeout didn't fire, this await never returns and the test times out.
  expect(Date.now() - start).toBeLessThan(2000);
});

test("timeout releases the lock so the next tick runs", async () => {
  const lock = memoryLock();
  await runCronJob(hungJob("poll", 50), { lock }); // hangs, times out, releases

  let ran = 0;
  await runCronJob(fastJob("poll", () => ran++, 50), { lock }); // same key
  expect(ran).toBe(1); // proves the lock was freed by the timeout
});

test("timeoutMs: 0 disables the timeout (legacy) — a fast job still runs", async () => {
  let ran = 0;
  await runCronJob(fastJob("legacy", () => ran++, 0), {});
  expect(ran).toBe(1);
});

test("per-job timeoutMs overrides the env default", async () => {
  const prev = Bun.env.CRON_JOB_TIMEOUT_MS;
  Bun.env.CRON_JOB_TIMEOUT_MS = "999999"; // huge global
  try {
    const start = Date.now();
    await runCronJob(hungJob("override", 50), {}); // per-job 50ms wins
    expect(Date.now() - start).toBeLessThan(2000);
  } finally {
    if (prev === undefined) delete Bun.env.CRON_JOB_TIMEOUT_MS;
    else Bun.env.CRON_JOB_TIMEOUT_MS = prev;
  }
});
