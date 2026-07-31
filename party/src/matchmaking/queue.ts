export interface MatchAssignment {
  roomId: string;
  expiresAt: number;
}

export interface MatchQueueState {
  waiting: string[];
  assignments: Record<string, MatchAssignment>;
}

export type FindResult =
  | { kind: "waiting" }
  | { kind: "assigned"; roomId: string }
  | { kind: "paired"; tickets: [string, string]; roomId: string }
  | { kind: "rejected" };

const EMPTY_STATE: MatchQueueState = { waiting: [], assignments: {} };
const ASSIGNMENT_LEASE_MS = 120_000;
export const MAX_WAITING = 256;
export const MAX_ASSIGNMENTS = 1_024;

export class MatchQueue {
  private waiting: string[];
  private assignments: Record<string, MatchAssignment>;
  private revisionValue = 0;

  constructor(
    private readonly makeRoomId: () => string,
    initial: MatchQueueState | undefined = EMPTY_STATE,
    private readonly now: () => number = Date.now,
  ) {
    this.waiting = [...new Set(initial.waiting)].slice(0, MAX_WAITING);
    this.assignments = Object.fromEntries(
      Object.entries(initial.assignments).slice(0, MAX_ASSIGNMENTS),
    );
    this.pruneExpired();
    this.revisionValue = 0;
  }

  find(ticket: string): FindResult {
    this.pruneExpired();
    const assigned = this.assignments[ticket];
    if (assigned) return { kind: "assigned", roomId: assigned.roomId };
    if (this.waiting.includes(ticket)) return { kind: "waiting" };

    const partner = this.waiting.shift();
    if (!partner) {
      if (this.waiting.length >= MAX_WAITING) return { kind: "rejected" };
      this.waiting.push(ticket);
      this.markChanged();
      return { kind: "waiting" };
    }

    if (Object.keys(this.assignments).length > MAX_ASSIGNMENTS - 2) {
      this.waiting.unshift(partner);
      return { kind: "rejected" };
    }

    const roomId = this.makeRoomId();
    const assignment = { roomId, expiresAt: this.now() + ASSIGNMENT_LEASE_MS };
    this.assignments[partner] = assignment;
    this.assignments[ticket] = assignment;
    this.markChanged();
    return { kind: "paired", tickets: [partner, ticket], roomId };
  }

  cancel(ticket: string): void {
    const before = this.waiting.length;
    this.waiting = this.waiting.filter((waitingTicket) => waitingTicket !== ticket);
    const assigned = this.assignments[ticket] !== undefined;
    delete this.assignments[ticket];
    if (this.waiting.length !== before || assigned) this.markChanged();
  }

  disconnect(ticket: string): void {
    const before = this.waiting.length;
    this.waiting = this.waiting.filter((waitingTicket) => waitingTicket !== ticket);
    if (this.waiting.length !== before) this.markChanged();
  }

  acknowledge(ticket: string, roomId: string): void {
    if (this.assignments[ticket]?.roomId !== roomId) return;
    delete this.assignments[ticket];
    this.markChanged();
  }

  reconcile(liveTickets: ReadonlySet<string>): void {
    const before = this.waiting.length;
    this.waiting = this.waiting.filter((ticket) => liveTickets.has(ticket));
    if (this.waiting.length !== before) this.markChanged();
  }

  snapshot(): MatchQueueState {
    this.pruneExpired();
    return { waiting: [...this.waiting], assignments: { ...this.assignments } };
  }

  get revision(): number {
    return this.revisionValue;
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [ticket, assignment] of Object.entries(this.assignments)) {
      if (assignment.expiresAt <= now) {
        delete this.assignments[ticket];
        this.markChanged();
      }
    }
  }

  private markChanged(): void {
    this.revisionValue += 1;
  }
}
