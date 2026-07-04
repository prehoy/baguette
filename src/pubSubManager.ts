import type { ServerWebSocket } from "bun";
import type { WSContext } from "hono/ws";

// In-memory room/channel fan-out for Bun WebSockets. Single-process; for
// multi-replica fan-out put a Redis pub/sub in front (app concern).
class PubSubManager {
  connections: {
    connection: WSContext<ServerWebSocket>;
    room: string;
    channel: string;
  }[] = [];

  addConnection = (c: {
    connection: WSContext<ServerWebSocket>;
    room: string;
    channel: string;
  }) => this.connections.push(c);

  removeConnection = (connection: WSContext<ServerWebSocket>) => {
    this.connections = this.connections.filter((c) => c.connection !== connection);
  };

  send = ({
    room,
    channel,
    message,
  }: {
    room: string;
    channel: string;
    message: string;
  }) => {
    for (const c of this.connections) {
      if (c.room === room && c.channel === channel) c.connection.send(message);
    }
  };
}

const pubSubManager = new PubSubManager();
export default pubSubManager;
