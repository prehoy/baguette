import { expect, test } from "bun:test";
import { runCronJob, type CronDefinition } from "../src/cron";
import { dispatchAutomation, type AutomationDefinition } from "../src/automations";

// --- cron: lock gating + enabled gating (no scheduler, no DB) ---

const makeJob = (name: string, onProcess: () => void): CronDefinition => ({
  details: { name, cron: { value: "* * * * *" } },
  process: async () => {
    onProcess();
    return "ok";
  },
});

test("cron runs the job when the lock is granted", async () => {
  let ran = 0;
  const grant = async (_k: string, fn: () => Promise<void>) => fn();
  await runCronJob(makeJob("a", () => ran++), { lock: grant });
  expect(ran).toBe(1);
});

test("cron skips the job when the lock is held elsewhere", async () => {
  let ran = 0;
  const deny = async () => {}; // never calls fn
  await runCronJob(makeJob("b", () => ran++), { lock: deny });
  expect(ran).toBe(0);
});

test("cron respects isEnabled=false", async () => {
  let ran = 0;
  await runCronJob(makeJob("c", () => ran++), {
    lock: async (_k, fn) => fn(),
    isEnabled: () => false,
  });
  expect(ran).toBe(0);
});

// --- automations: dispatch routes by trigger name only ---

const auto = (name: string, trigger: string, hit: (p: string) => void): AutomationDefinition => ({
  details: { name, trigger: { name: trigger } },
  automation: async (payload) => {
    hit(payload);
    return { status: "SUCCESS" };
  },
});

test("automation dispatch fires only matching triggers", async () => {
  const fired: string[] = [];
  const list = [
    auto("mkInvoice", "payment_insert", () => fired.push("mkInvoice")),
    auto("syncCrm", "customer_update", () => fired.push("syncCrm")),
  ];
  await dispatchAutomation(list, "payment_insert", "{}");
  expect(fired).toEqual(["mkInvoice"]);
});

test("automation dispatch passes the payload and honours isEnabled", async () => {
  let seen = "";
  const list = [auto("x", "order_insert", (p) => (seen = p))];
  await dispatchAutomation(list, "order_insert", '{"id":1}', { isEnabled: () => true });
  expect(seen).toBe('{"id":1}');

  seen = "";
  await dispatchAutomation(list, "order_insert", '{"id":2}', { isEnabled: () => false });
  expect(seen).toBe("");
});
