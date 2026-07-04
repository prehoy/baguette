import type { ServerWebSocket } from "bun";
import { createBunWebSocket } from "hono/bun";
import pubSubManager from "./pubSubManager";

// One shared pair for the whole app: `upgradeWebSocket` mounts WS routes on the
// Hono app; `websocket` is handed to Bun.serve. serve() wires `websocket`
// automatically, so WebSockets work as soon as you mount an upgrade handler.
const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();
export { upgradeWebSocket, websocket };

/**
 * Ready-made room/channel pub/sub endpoint. `serve({ ws: true })` mounts it at
 * `/api/ws/:room/:channel`; broadcast from anywhere with
 * `pubSubManager.send({ room, channel, message })`.
 */
export function pubSubWebSocket() {
  return upgradeWebSocket((c) => {
    const { room, channel } = c.req.param();
    return {
      onOpen: (_evt, ws) => pubSubManager.addConnection({ connection: ws, room, channel }),
      onClose: (_evt, ws) => pubSubManager.removeConnection(ws),
    };
  });
}
