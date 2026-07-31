import type * as Party from "partykit/server";
import {
  CREAK_NOISE,
  MAX_MOVE_PER_TICK_FACTOR,
  MIC_GATE,
  SPRINT_SPEED,
  PICKUP_DIST,
  SPAWN_GRACE_S,
  TICK_MS,
  cellIndex,
  creakyCells,
  directorOnDown,
  encode,
  generateLevel,
  hashSeed,
  heardLoudness,
  rawLoudness,
  wallsBetween,
  levelSeed,
  makeDirector,
  makeMonster,
  makeRng,
  parseClientMsg,
  placeKeys,
  stepMonster,
  tickDirector,
  type ClientMsg,
  type KeyItem,
  type Director,
  type Maze,
  type MonsterState,
  type Phase,
  type PlayerState,
  type Rng,
  type SensedPlayer,
  type ServerMsg,
} from "@liminal/shared";
import { ChatLedger } from "./chat.js";
import { LAST_LEVEL, levelDef } from "./levels.js";
import { Outage } from "./outage.js";
import { CommandQueue, type RoomCommand } from "./sim/commands.js";
import { canNoclip, tickRevives } from "./sim/cooperation.js";
import { admitConnection, expireDisconnected } from "./sim/roster.js";

const DT = TICK_MS / 1000;

export default class GameRoom implements Party.Server {
  private readonly players = new Map<string, PlayerState>();
  private readonly prevPos = new Map<string, { x: number; z: number }>();
  private readonly lit = new Map<string, boolean>();
  private readonly mic = new Map<string, number>();
  /** Where each client says it is. The tick decides how much of that it believes. */
  private readonly wanted = new Map<string, { x: number; z: number }>();
  /** Per-tick: how much of each player's noise actually reaches the creature. */
  private readonly reaching = new Map<string, number>();
  private readonly seed: number;
  private readonly rng: Rng;
  private level = 0;
  private maze: Maze;
  private monster: MonsterState;
  private keys: KeyItem[] = [];
  private creaky: Set<number> = new Set();
  private director: Director = makeDirector();
  private readonly outage = new Outage();
  private readonly chat = new ChatLedger();
  private readonly commands = new CommandQueue();
  private readonly connections = new Map<string, Party.Connection>();
  private readonly disconnectedAt = new Map<string, number>();
  private phase: Phase = "playing";
  private runS = 0;
  private tick = 0;
  private version = 0;
  private loop: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {
    this.seed = hashSeed(room.id);
    this.rng = makeRng(this.seed ^ 0x9e3779b9); // director/wander rolls — seeded, replayable
    this.maze = generateLevel(levelSeed(this.seed, 0), 0);
    this.monster = makeMonster(this.maze.exit);
    this.stockLevel(0);
  }

  private stockLevel(level: number): void {
    const s = levelSeed(this.seed, level);
    this.keys = placeKeys(s, this.maze);
    this.creaky = creakyCells(s, this.maze);
  }

  onConnect(conn: Party.Connection): void {
    this.commands.enqueueLifecycle({ kind: "connect", connection: conn });
    this.ensureLoop();
  }

  onMessage(raw: string, sender: Party.Connection): void {
    const msg = parseClientMsg(raw);
    if (!msg) {
      this.log("game_message_rejected", { connectionId: sender.id });
      return;
    }
    if (!this.commands.enqueue({ kind: "message", senderId: sender.id, message: msg })) {
      this.log("command_queue_full", { connectionId: sender.id });
    }
  }

  onClose(conn: Party.Connection): void {
    this.commands.enqueueLifecycle({ kind: "disconnect", connection: conn });
  }

  onError(conn: Party.Connection): void {
    this.onClose(conn);
  }

  private applyMessage(senderId: string, msg: ClientMsg): void {
    const p = this.players.get(senderId);
    if (!p || !this.connections.has(senderId)) return;
    if (msg.t === "join") {
      p.name = msg.name;
    } else if (msg.t === "move") {
      if (this.phase !== "playing" || p.down) return;
      // position is a REQUEST, not a fact — the tick clamps it (see applyWantedPositions)
      this.wanted.set(p.id, { x: msg.x, z: msg.z });
      p.ry = msg.ry;
      this.lit.set(p.id, msg.lit === true);
      this.mic.set(p.id, msg.mic ?? 0);
    } else if (msg.t === "grab") {
      if (this.phase !== "playing" || p.down) return;
      // the room decides: you must actually be standing on it
      const key = this.keys.find((k) => k.id === msg.id);
      if (key && Math.hypot(p.x - key.x, p.z - key.z) < PICKUP_DIST) {
        this.keys = this.keys.filter((k) => k.id !== msg.id);
      }
    } else if (msg.t === "restart") {
      this.phase = "playing";
      this.runS = 0;
      this.enterLevel(0);
    } else if (msg.t === "chat") {
      const chatMessage = this.chat.commit(p.id, p.name, msg.text, this.tick);
      if (chatMessage) this.broadcast({ t: "chat", message: chatMessage });
    }
  }

  private applyCommand(command: RoomCommand): void {
    if (command.kind === "connect") {
      admitConnection(
        {
          players: this.players,
          connections: this.connections,
          disconnectedAt: this.disconnectedAt,
          start: this.maze.start,
          seed: this.seed,
          version: this.version,
          chat: this.chat.state(),
        },
        command.connection,
      );
      return;
    }
    if (command.kind === "disconnect") {
      if (this.connections.get(command.connection.id) !== command.connection) return;
      this.connections.delete(command.connection.id);
      this.disconnectedAt.set(command.connection.id, this.tick);
      return;
    }
    this.applyMessage(command.senderId, command.message);
  }

  private enterLevel(level: number): void {
    this.level = level;
    this.maze = generateLevel(levelSeed(this.seed, level), level);
    this.monster = makeMonster(this.maze.exit);
    this.director = makeDirector();
    this.outage.reset(this.rng);
    this.stockLevel(level);
    for (const p of this.players.values()) {
      p.x = this.maze.start.x;
      p.z = this.maze.start.z;
      p.down = false;
      p.reviveP = 0;
      p.noise = 0;
      p.heard = false;
    }
  }

  private ensureLoop(): void {
    if (!this.loop) this.loop = setInterval(() => this.step(), TICK_MS);
  }

  private stopLoop(): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  private step(): void {
    this.tick += 1;
    for (const command of this.commands.drain()) this.applyCommand(command);
    expireDisconnected({
      players: this.players,
      disconnectedAt: this.disconnectedAt,
      prevPos: this.prevPos,
      lit: this.lit,
      mic: this.mic,
      tick: this.tick,
    });
    if (this.phase === "playing") this.simulate();
    this.version += 1;
    this.broadcast({
      t: "state",
      version: this.version,
      phase: this.phase,
      level: this.level,
      outage: this.outage.dark,
      keysLeft: this.keys.map((k) => k.id),
      players: Array.from(this.players.values()),
      entity: { x: this.monster.x, z: this.monster.z, mood: this.director.mood },
    });
    if (this.players.size === 0 && this.commands.size === 0) this.stopLoop();
  }

  private simulate(): void {
    const all = Array.from(this.players.values());
    if (all.length === 0) return;
    this.runS += DT;
    tickRevives(all, DT);

    const standing = all.filter((p) => !p.down);
    if (standing.length === 0) {
      this.phase = "lost";
      return;
    }
    if (canNoclip(standing, this.maze, this.keys.length)) {
      if (this.level >= LAST_LEVEL) this.phase = "won";
      else this.enterLevel(this.level + 1);
      return;
    }

    this.applyWantedPositions(all);

    // Always measure how loud everyone is: the players need to SEE the mechanic that is
    // hunting them, and the HUD reads this straight off the snapshot.
    for (const p of all) {
      if (p.down) {
        p.noise = 0;
        p.heard = false;
        continue;
      }
      const { made, reaching } = this.measureNoise(p);
      p.noise = made;
      p.heard = reaching >= MIC_GATE;
      this.reaching.set(p.id, reaching);
    }

    const def = levelDef(this.level);
    if (def.breather) return; // the Poolrooms: nothing lives here
    if (def.outages) this.outage.tick(DT, this.rng);
    if (this.runS < SPAWN_GRACE_S) return; // emptiness is the product

    this.tickMonster(standing, def.rule);
  }

  private tickMonster(standing: PlayerState[], rule: ReturnType<typeof levelDef>["rule"]): void {
    const sensedPlayers = standing.map((p) => this.toSensed(p));

    let nearest = standing[0]!;
    let nearestDist = Infinity;
    let loudest: PlayerState | null = null;
    let loudestNoise = 0;
    for (const p of standing) {
      const d = Math.hypot(p.x - this.monster.x, p.z - this.monster.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = p;
      }
      const noise = this.reaching.get(p.id) ?? 0;
      if (noise > loudestNoise) {
        loudestNoise = noise;
        loudest = p;
      }
    }

    // blind creature: "exposed" means close with nothing solid between, never sight through walls
    const exposed =
      nearestDist < 8 && wallsBetween(this.maze, nearest, this.monster) === 0;
    tickDirector(
      this.director,
      { nearestDistU: nearestDist, noise: loudestNoise, exposed, dtS: DT },
      this.rng,
    );

    const { caught } = stepMonster(
      this.monster,
      this.maze,
      this.director.mood,
      rule,
      {
        nearest: this.toSensed(nearest),
        nearestDist,
        loudest: loudest && loudestNoise >= MIC_GATE ? this.toSensed(loudest) : null,
        dark: this.outage.dark,
      },
      sensedPlayers,
      this.director.inStateS,
      DT,
      this.rng,
    );

    if (caught) {
      nearest.down = true;
      nearest.reviveP = 0;
      directorOnDown(this.director, this.rng); // never camp a body
      this.monster.lungeS = -1;
      this.monster.staggerS = 0;
    }
  }

  private toSensed(p: PlayerState): SensedPlayer {
    return { x: p.x, z: p.z, ry: p.ry, lit: this.lit.get(p.id) === true };
  }

  /** Move each player toward where their client claims to be, but no faster than a sprinting
   *  human could. Without this a client can teleport onto every key and finish in seconds. */
  private applyWantedPositions(all: PlayerState[]): void {
    const maxStep = SPRINT_SPEED * DT * MAX_MOVE_PER_TICK_FACTOR;
    for (const p of all) {
      const want = this.wanted.get(p.id);
      if (!want) continue;
      this.wanted.delete(p.id);
      const dx = want.x - p.x;
      const dz = want.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= maxStep) {
        p.x = want.x;
        p.z = want.z;
        continue;
      }
      const t = maxStep / dist;
      p.x += dx * t;
      p.z += dz * t;
      this.log("move_clamped", { connectionId: p.id, requestedU: dist.toFixed(2) });
    }
  }

  /** What this player emits this tick, and how much of it reaches the creature. Both numbers
   *  come from shared/hearing, so the simulation and the HUD can never disagree. */
  private measureNoise(p: PlayerState): { made: number; reaching: number } {
    const prev = this.prevPos.get(p.id);
    const speed = prev ? Math.hypot(p.x - prev.x, p.z - prev.z) / DT : 0;
    this.prevPos.set(p.id, { x: p.x, z: p.z });
    // a creaky board under a moving foot is as loud as a voice — Granny's floor
    const creak = speed > 0.05 && this.creaky.has(cellIndex(this.maze, p.x, p.z)) ? CREAK_NOISE : 0;
    const voice = Math.max(this.mic.get(p.id) ?? 0, creak);
    return {
      made: rawLoudness(speed, voice),
      reaching: heardLoudness(this.maze, p, this.monster, speed, voice),
    };
  }

  private broadcast(message: ServerMsg): void {
    const raw = encode(message);
    for (const connection of this.connections.values()) {
      if (connection.readyState === 1) connection.send(raw);
    }
  }

  private log(event: string, details: Record<string, string>): void {
    console.info(JSON.stringify({ event, roomId: this.room.id, ...details }));
  }
}
