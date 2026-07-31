import type * as Party from "partykit/server";
import { encode, parseMatchClientMsg } from "@liminal/shared";
import { MatchQueue, type MatchQueueState } from "./queue.js";

const STORAGE_KEY = "match-queue";

function makeRoomId(): string {
  return crypto.randomUUID();
}

export default class MatchmakingRoom implements Party.Server {
  private queue = new MatchQueue(makeRoomId);
  private lastRejectionLogAt = 0;
  private readonly lastLogAt = new Map<string, number>();

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
      this.logRejection("match_message_rejected");
      return;
    }
    const revision = this.queue.revision;
    if (message.t === "find_match") this.find(sender);
    if (message.t === "cancel_match") {
      this.queue.cancel(sender.id);
      this.announceWaiting();
    }
    if (message.t === "match_ack") this.queue.acknowledge(sender.id, message.roomId);
    if (this.queue.revision !== revision) await this.persist();
  }

  async onClose(connection: Party.Connection): Promise<void> {
    const revision = this.queue.revision;
    this.queue.disconnect(connection.id);
    this.announceWaiting();
    if (this.queue.revision !== revision) await this.persist();
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
    if (result.kind === "rejected") {
      sender.send(encode({ t: "match_unavailable" }));
      sender.close(1013, "matchmaking busy");
      this.logRejection("match_capacity_rejected");
      return;
    }
    for (const ticket of result.tickets) {
      this.room.getConnection(ticket)?.send(encode({ t: "match_found", roomId: result.roomId }));
    }
    this.logBounded("match_paired");
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

  private logRejection(event: string): void {
    const now = Date.now();
    if (now - this.lastRejectionLogAt < 10_000) return;
    this.lastRejectionLogAt = now;
    this.log(event, {});
  }

  private logBounded(event: string): void {
    const now = Date.now();
    const last = this.lastLogAt.get(event) ?? -Infinity;
    if (now - last < 10_000) return;
    this.lastLogAt.set(event, now);
    this.log(event, {});
  }
}
