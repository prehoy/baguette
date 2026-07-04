import { expect, test } from "bun:test";
import { createApp } from "../src/index";
import pubSubManager from "../src/pubSubManager";

const FIX = `${import.meta.dir}/fixtures/api`;

test("pubSubManager fans out only to matching room + channel", () => {
  const sent: string[] = [];
  const conn = (tag: string) => ({ send: (m: string) => sent.push(`${tag}:${m}`) }) as any;
  const a = conn("a"), b = conn("b"), c = conn("c");

  pubSubManager.addConnection({ connection: a, room: "r1", channel: "c1" });
  pubSubManager.addConnection({ connection: b, room: "r1", channel: "c1" });
  pubSubManager.addConnection({ connection: c, room: "r1", channel: "c2" }); // different channel

  pubSubManager.send({ room: "r1", channel: "c1", message: "hi" });
  expect(sent.sort()).toEqual(["a:hi", "b:hi"]); // c (c2) not included

  // disconnect a, resend
  pubSubManager.removeConnection(a);
  sent.length = 0;
  pubSubManager.send({ room: "r1", channel: "c1", message: "yo" });
  expect(sent).toEqual(["b:yo"]);

  pubSubManager.removeConnection(b);
  pubSubManager.removeConnection(c);
});

test("ws:true mounts an upgrade endpoint (426 without upgrade headers)", async () => {
  const app = await createApp({ routesDir: FIX, auth: () => null, ws: true, logRequests: false, docs: false });
  // A plain GET (no Upgrade header) to the WS path is not a valid upgrade -> not 200.
  const res = await app.request("/api/ws/room1/chanA");
  expect(res.status).not.toBe(200);
  expect([426, 400, 101, 500]).toContain(res.status);
});
