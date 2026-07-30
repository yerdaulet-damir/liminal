import type * as Party from "partykit/server";
import type { ClientMsg } from "@liminal/shared";

export type RoomCommand =
  | { kind: "connect"; connection: Party.Connection }
  | { kind: "disconnect"; connection: Party.Connection }
  | { kind: "message"; senderId: string; message: ClientMsg };

const MAX_PENDING_COMMANDS = 256;

export class CommandQueue {
  private lifecycle: RoomCommand[] = [];
  private pending: RoomCommand[] = [];

  enqueue(command: RoomCommand): boolean {
    if (this.pending.length >= MAX_PENDING_COMMANDS) return false;
    this.pending.push(command);
    return true;
  }

  enqueueLifecycle(command: Extract<RoomCommand, { kind: "connect" | "disconnect" }>): void {
    this.lifecycle.push(command);
  }

  drain(): RoomCommand[] {
    const commands = [...this.lifecycle, ...this.pending];
    this.lifecycle = [];
    this.pending = [];
    return commands;
  }

  get size(): number {
    return this.lifecycle.length + this.pending.length;
  }
}
