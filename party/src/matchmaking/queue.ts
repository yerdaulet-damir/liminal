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
  | { kind: "paired"; tickets: [string, string]; roomId: string };

const EMPTY_STATE: MatchQueueState = { waiting: [], assignments: {} };
const ASSIGNMENT_LEASE_MS = 120_000;

export class MatchQueue {
  private waiting: string[];
  private assignments: Record<string, MatchAssignment>;

  constructor(
    private readonly makeRoomId: () => string,
    initial: MatchQueueState | undefined = EMPTY_STATE,
    private readonly now: () => number = Date.now,
  ) {
    this.waiting = [...new Set(initial.waiting)];
    this.assignments = { ...initial.assignments };
  }

  find(ticket: string): FindResult {
    this.pruneExpired();
    const assigned = this.assignments[ticket];
    if (assigned) return { kind: "assigned", roomId: assigned.roomId };
    if (this.waiting.includes(ticket)) return { kind: "waiting" };

    const partner = this.waiting.shift();
    if (!partner) {
      this.waiting.push(ticket);
      return { kind: "waiting" };
    }

    const roomId = this.makeRoomId();
    const assignment = { roomId, expiresAt: this.now() + ASSIGNMENT_LEASE_MS };
    this.assignments[partner] = assignment;
    this.assignments[ticket] = assignment;
    return { kind: "paired", tickets: [partner, ticket], roomId };
  }

  cancel(ticket: string): void {
    this.waiting = this.waiting.filter((waitingTicket) => waitingTicket !== ticket);
    delete this.assignments[ticket];
  }

  disconnect(ticket: string): void {
    this.waiting = this.waiting.filter((waitingTicket) => waitingTicket !== ticket);
  }

  acknowledge(ticket: string, roomId: string): void {
    if (this.assignments[ticket]?.roomId === roomId) delete this.assignments[ticket];
  }

  reconcile(liveTickets: ReadonlySet<string>): void {
    this.waiting = this.waiting.filter((ticket) => liveTickets.has(ticket));
  }

  snapshot(): MatchQueueState {
    this.pruneExpired();
    return { waiting: [...this.waiting], assignments: { ...this.assignments } };
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [ticket, assignment] of Object.entries(this.assignments)) {
      if (assignment.expiresAt <= now) delete this.assignments[ticket];
    }
  }
}
