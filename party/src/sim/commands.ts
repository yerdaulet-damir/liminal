import type * as Party from "partykit/server";
import type { ClientMsg } from "@liminal/shared";

export type RoomCommand =
  | { kind: "connect"; connection: Party.Connection }
  | { kind: "disconnect"; connection: Party.Connection }
  | { kind: "message"; senderId: string; message: ClientMsg };

const MAX_DISCRETE_COMMANDS = 64;
const MAX_DISCRETE_PER_SENDER = 8;

export class CommandQueue {
  private lifecycle: RoomCommand[] = [];
  private discrete: RoomCommand[] = [];
  private readonly discreteBySender = new Map<string, number>();
  private readonly moves = new Map<string, Extract<RoomCommand, { kind: "message" }>>();

  enqueue(command: RoomCommand): boolean {
    if (command.kind !== "message") return false;
    if (command.message.t === "move") {
      this.moves.set(command.senderId, command);
      return true;
    }
    const senderCount = this.discreteBySender.get(command.senderId) ?? 0;
    if (senderCount >= MAX_DISCRETE_PER_SENDER || this.discrete.length >= MAX_DISCRETE_COMMANDS) {
      return false;
    }
    this.discrete.push(command);
    this.discreteBySender.set(command.senderId, senderCount + 1);
    return true;
  }

  enqueueLifecycle(command: Extract<RoomCommand, { kind: "connect" | "disconnect" }>): void {
    this.lifecycle.push(command);
  }

  drain(): RoomCommand[] {
    const commands = [...this.lifecycle, ...this.discrete, ...this.moves.values()];
    this.lifecycle = [];
    this.discrete = [];
    this.discreteBySender.clear();
    this.moves.clear();
    return commands;
  }

  get size(): number {
    return this.lifecycle.length + this.discrete.length + this.moves.size;
  }
}
