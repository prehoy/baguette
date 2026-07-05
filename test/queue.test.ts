import { expect, test } from "bun:test";
import { defineQueue, isQueue, loadQueues } from "../src/queue";
import { emailQueue } from "../src/email";

// Redis-free: exercise the file-based loading + handle shape. Actual
// enqueue/process needs a running Redis (like the cron redis lock).

test("defineQueue produces a typed handle", () => {
  const q = defineQueue<{ x: number }>({ name: "test-q", concurrency: 4, process: async () => {} });
  expect(q.name).toBe("test-q");
  expect(isQueue(q)).toBe(true);
  expect(typeof q.add).toBe("function");
});

test("loadQueues loads folder-based queue files into handles", async () => {
  const qs = await loadQueues(`${import.meta.dir}/../examples/queues`);
  expect(qs.map((q) => q.name)).toContain("resize-image");
  expect(qs.every(isQueue)).toBe(true);
});

test("emailQueue is a ready-made queue handle", () => {
  expect(isQueue(emailQueue)).toBe(true);
  expect(emailQueue.name).toBe("baguette-email");
});
