import type * as Party from "partykit/server";
import { encode, parseMatchClientMsg } from "@liminal/shared";
import { MatchQueue, type MatchQueueState } from "./queue.js";

const STORAGE_KEY = "match-queue";

function makeRoomId(): string {
  return crypto.randomUUID();
}

export default class MatchmakingRoom implements Party.Server {
  private queue = new MatchQueue(makeRoomId);

  constructor(readonly room: Party.Room) {}

  async onStart(): Promise<void> {
    const stored = await this.room.storage.get<MatchQueueState>(STORAGE_KEY);
    this.queue = new MatchQueue(makeRoomId, stored ?? { waiting: [], assignments: {} });
    this.reconcileWaiting();
    await this.persist();
  }

  onConnect(connection: Party.Connection): void {
    const assignment = this.queue.snapshot().assignments[connection.id];
    if (assignment) connection.send(encode({ t: "match_found", roomId: assignment.roomId }));
  }

  async onMessage(raw: string, sender: Party.Connection): Promise<void> {
    const message = parseMatchClientMsg(raw);
    if (!message) {
      this.log("match_message_rejected", { ticket: sender.id });
      return;
    }
    if (message.t === "find_match") this.find(sender);
    if (message.t === "cancel_match") {
      this.queue.cancel(sender.id);
      this.announceWaiting();
    }
    if (message.t === "match_ack") this.queue.acknowledge(sender.id, message.roomId);
    await this.persist();
  }

  async onClose(connection: Party.Connection): Promise<void> {
    this.queue.disconnect(connection.id);
    this.announceWaiting();
    await this.persist();
  }

  async onError(connection: Party.Connection): Promise<void> {
    await this.onClose(connection);
  }

  private find(sender: Party.Connection): void {
    this.reconcileWaiting();
    const result = this.queue.find(sender.id);
    if (result.kind === "waiting") {
      this.announceWaiting();
      return;
    }
    if (result.kind === "assigned") {
      sender.send(encode({ t: "match_found", roomId: result.roomId }));
      return;
    }
    for (const ticket of result.tickets) {
      this.room.getConnection(ticket)?.send(encode({ t: "match_found", roomId: result.roomId }));
    }
    this.log("match_paired", { roomId: result.roomId });
    this.announceWaiting();
  }

  /** Everyone still queuing is an open game; tell them how many doors are open. */
  private announceWaiting(): void {
    const waiting = this.queue.snapshot().waiting;
    for (const ticket of waiting) {
      this.room.getConnection(ticket)?.send(
        encode({ t: "match_waiting", waiting: waiting.length }),
      );
    }
  }

  private reconcileWaiting(): void {
    const live = new Set(Array.from(this.room.getConnections(), (connection) => connection.id));
    this.queue.reconcile(live);
  }

  private persist(): Promise<void> {
    return this.room.storage.put(STORAGE_KEY, this.queue.snapshot());
  }

  private log(event: string, details: Record<string, string>): void {
    console.info(JSON.stringify({ event, ...details }));
  }
}
