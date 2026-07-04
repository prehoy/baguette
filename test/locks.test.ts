import { expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { memoryLock, sqliteLock } from "../src/cron";

// --- memory lock (default backend) ---

test("memoryLock skips a run that overlaps the same key", async () => {
  const lock = memoryLock();
  let runs = 0;
  let peak = 0;
  let live = 0;
  const job = async () => {
    live++;
    peak = Math.max(peak, live);
    await Bun.sleep(20);
    runs++;
    live--;
  };
  await Promise.all([lock("a", job), lock("a", job)]); // 2nd sees the lock held -> skips
  expect(runs).toBe(1);
  expect(peak).toBe(1);
});

test("memoryLock runs different keys concurrently", async () => {
  const lock = memoryLock();
  let runs = 0;
  await Promise.all([
    lock("a", async () => void runs++),
    lock("b", async () => void runs++),
  ]);
  expect(runs).toBe(2);
});

test("memoryLock releases so the next run is granted", async () => {
  const lock = memoryLock();
  let runs = 0;
  await lock("a", async () => void runs++);
  await lock("a", async () => void runs++);
  expect(runs).toBe(2);
});

// --- sqlite lock (persistent, single-node) ---

test("sqliteLock grants once, skips while held, re-grants after release", async () => {
  const file = path.join(tmpdir(), "baguette-cron-lock-test.sqlite");
  if (existsSync(file)) rmSync(file);
  const lock = sqliteLock(file);

  let runs = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));

  const first = lock("job", async () => {
    runs++;
    await gate; // hold the lock open
  });
  await Bun.sleep(5); // let `first` acquire

  await lock("job", async () => void runs++); // held -> skipped
  expect(runs).toBe(1);

  release();
  await first;

  await lock("job", async () => void runs++); // free -> runs
  expect(runs).toBe(2);

  rmSync(file);
});
