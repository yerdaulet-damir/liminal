import type * as Party from "partykit/server";
import {
  FLASHLIGHT_S, MIC_GATE, PICKUP_DIST, SPAWN_GRACE_S, TICK_MS,
  creakyCells, encode, generateLevel, hashSeed, levelSeed,
  makeDirector, makeMonster, makeRng, parseClientMsg, placeKeys, placeProps,
  type ClientMsg, type Director, type KeyItem, type Maze, type MonsterState,
  type Phase, type PlayerState, type PropPlacement, type Rng, type ServerMsg,
} from "@liminal/shared";
import { ChatLedger } from "./chat.js";
import { LAST_LEVEL, levelDef } from "./levels.js";
import { Outage } from "./outage.js";
import { CommandQueue, type RoomCommand } from "./sim/commands.js";
import { canNoclip, tickRevives } from "./sim/cooperation.js";
import { Flashlights } from "./sim/flashlights.js";
import { PlayerMovement } from "./sim/movement.js";
import { tickMonsterEncounter } from "./sim/monsterEncounter.js";
import { measurePlayerNoise } from "./sim/playerNoise.js";
import { RoomLog } from "./sim/roomLog.js";
import { admitJoin, expireDisconnected } from "./sim/roster.js";

const DT = TICK_MS / 1000;
const ROOM_INSTANCE_MARKER = "authoritative-room-created";
const MAX_PENDING_HANDSHAKES = 8;
const HANDSHAKE_TTL_TICKS = 5 * (1000 / TICK_MS);

export default class GameRoom implements Party.Server {
  private readonly players = new Map<string, PlayerState>();
  private readonly prevPos = new Map<string, { x: number; z: number }>();
  private readonly mic = new Map<string, number>();
  private readonly movement = new PlayerMovement();
  private readonly reaching = new Map<string, number>();
  private readonly seed: number;
  private readonly rng: Rng;
  private level = 0;
  private maze: Maze;
  private monster: MonsterState;
  private keys: KeyItem[] = [];
  private props: PropPlacement[] = [];
  private creaky: Set<number> = new Set();
  private director: Director = makeDirector();
  private readonly outage = new Outage();
  private readonly chat = new ChatLedger();
  private readonly commands = new CommandQueue();
  private readonly connections = new Map<string, Party.Connection>();
  private readonly pendingConnections = new Map<string, Party.Connection>();
  private readonly pendingAt = new Map<string, number>();
  private readonly transportPlayers = new Map<string, string>();
  private readonly disconnectedAt = new Map<string, number>();
  private readonly playerByToken = new Map<string, string>();
  private readonly tokenByPlayer = new Map<string, string>();
  private readonly flashlights = new Flashlights();
  private readonly restartVotes = new Set<string>();
  private readonly logger: RoomLog;
  private phase: Phase = "playing";
  private runS = 0;
  private tick = 0;
  private version = 0;
  private loop: ReturnType<typeof setInterval> | null = null;
  private unavailable = false;
  private teardownStarted = false;

  constructor(readonly room: Party.Room) {
    this.logger = new RoomLog();
    this.seed = hashSeed(room.id);
    this.rng = makeRng(this.seed ^ 0x9e3779b9); // director/wander rolls — seeded, replayable
    this.maze = generateLevel(levelSeed(this.seed, 0), 0);
    this.monster = makeMonster(this.maze.exit);
    this.stockLevel(0);
  }

  async onStart(): Promise<void> {
    const alreadyCreated = await this.room.storage.get<boolean>(ROOM_INSTANCE_MARKER);
    if (alreadyCreated) {
      this.unavailable = true;
      return;
    }
    await this.room.storage.put(ROOM_INSTANCE_MARKER, true);
  }

  private stockLevel(level: number): void {
    const s = levelSeed(this.seed, level);
    this.keys = placeKeys(s, this.maze);
    this.props = placeProps(s, this.maze, level);
    this.creaky = creakyCells(s, this.maze);
  }

  onConnect(conn: Party.Connection): void {
    this.commands.enqueueLifecycle({ kind: "connect", connection: conn });
    this.ensureLoop();
  }

  onMessage(raw: string, sender: Party.Connection): void {
    const msg = parseClientMsg(raw);
    if (!msg) {
      this.logger.rejection("game_message_rejected", this.tick);
      return;
    }
    if (!this.commands.enqueue({ kind: "message", senderId: sender.id, message: msg })) {
      this.logger.rejection("command_queue_full", this.tick);
    }
    this.ensureLoop();
  }

  onClose(conn: Party.Connection): void {
    this.commands.enqueueLifecycle({ kind: "disconnect", connection: conn });
    this.ensureLoop();
  }

  onError(conn: Party.Connection): void {
    this.onClose(conn);
  }

  private applyMessage(senderId: string, msg: ClientMsg): void {
    if (msg.t === "join") {
      const connection = this.pendingConnections.get(senderId);
      if (!connection) return;
      const admission = admitJoin(
        {
          players: this.players,
          connections: this.connections,
          transportPlayers: this.transportPlayers,
          disconnectedAt: this.disconnectedAt,
          playerByToken: this.playerByToken,
          tokenByPlayer: this.tokenByPlayer,
          start: this.maze.start,
          seed: this.seed,
          version: this.version,
          chat: this.chat.state(),
        },
        connection,
        msg.name,
        msg.resumeToken,
      );
      this.pendingConnections.delete(senderId);
      this.pendingAt.delete(senderId);
      if (admission?.created) {
        this.flashlights.add(admission.playerId);
        this.restartVotes.clear();
      }
      if (admission) {
        this.logger.bounded(admission.created ? "player_admitted" : "player_resumed", this.tick);
      }
      else this.logger.rejection("join_rejected", this.tick);
      if (admission) this.clearPlayerTransient(admission.playerId);
      return;
    }
    const playerId = this.transportPlayers.get(senderId);
    const p = playerId ? this.players.get(playerId) : undefined;
    if (!p || !this.connections.has(p.id)) return;
    if (msg.t === "move") {
      if (this.phase !== "playing" || p.down) return;
      // position is a REQUEST, not a fact — the tick clamps it (see applyWantedPositions)
      this.movement.request(p.id, { x: msg.x, z: msg.z }, msg.mode ?? "walk");
      p.ry = msg.ry;
      this.flashlights.request(p.id, msg.lit === true);
      this.mic.set(p.id, msg.mic ?? 0);
    } else if (msg.t === "grab") {
      if (this.phase !== "playing" || p.down) return;
      // the room decides: you must actually be standing on it
      const key = this.keys.find((k) => k.id === msg.id);
      if (key && Math.hypot(p.x - key.x, p.z - key.z) < PICKUP_DIST) {
        this.keys = this.keys.filter((k) => k.id !== msg.id);
      }
    } else if (msg.t === "restart") {
      if (this.phase === "playing") return;
      this.restartVotes.add(p.id);
      if (Array.from(this.connections.keys()).every((id) => this.restartVotes.has(id))) {
        this.setPhase("playing");
        this.runS = 0;
        this.enterLevel(0);
      }
    } else if (msg.t === "chat") {
      const chatMessage = this.chat.commit(p.id, p.name, msg.text, this.tick);
      if (chatMessage) this.broadcast({ t: "chat", message: chatMessage });
    }
  }

  private applyCommand(command: RoomCommand): void {
    if (command.kind === "connect") {
      if (this.unavailable || this.teardownStarted) {
        command.connection.send(encode({ t: "room_unavailable" }));
        command.connection.close(1012, "room instance unavailable");
        this.logger.rejection("room_unavailable_rejected", this.tick);
        return;
      }
      if (this.pendingConnections.size >= MAX_PENDING_HANDSHAKES) {
        command.connection.close(1008, "handshake capacity exceeded");
        this.logger.rejection("handshake_capacity_rejected", this.tick);
        return;
      }
      this.pendingConnections.set(command.connection.id, command.connection);
      this.pendingAt.set(command.connection.id, this.tick);
      return;
    }
    if (command.kind === "disconnect") {
      this.pendingConnections.delete(command.connection.id);
      this.pendingAt.delete(command.connection.id);
      const playerId = this.transportPlayers.get(command.connection.id);
      this.transportPlayers.delete(command.connection.id);
      if (!playerId || this.connections.get(playerId) !== command.connection) return;
      this.connections.delete(playerId);
      this.disconnectedAt.set(playerId, this.tick);
      this.clearPlayerTransient(playerId);
      this.logger.bounded("player_disconnected", this.tick);
      return;
    }
    this.applyMessage(command.senderId, command.message);
  }

  private enterLevel(level: number): void {
    this.level = level;
    this.logger.event("level_entered", { level });
    this.maze = generateLevel(levelSeed(this.seed, level), level);
    this.monster = makeMonster(this.maze.exit);
    this.director = makeDirector();
    this.outage.reset(this.rng);
    this.stockLevel(level);
    this.flashlights.reset(this.players.keys());
    this.movement.reset(this.players.keys());
    this.restartVotes.clear();
    for (const p of this.players.values()) {
      p.x = this.maze.start.x;
      p.z = this.maze.start.z;
      p.down = false;
      p.reviveP = 0;
      p.noise = 0;
      p.heard = false;
      p.lit = false;
      p.flashlightS = FLASHLIGHT_S;
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
    this.expirePendingHandshakes();
    const expired = expireDisconnected({
      players: this.players,
      disconnectedAt: this.disconnectedAt,
      prevPos: this.prevPos,
      playerByToken: this.playerByToken,
      tokenByPlayer: this.tokenByPlayer,
      tick: this.tick,
    });
    for (const id of expired) {
      this.flashlights.remove(id);
      this.movement.remove(id);
      this.mic.delete(id);
      this.restartVotes.clear();
    }
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
    if (this.players.size !== 0 || this.pendingConnections.size !== 0 || this.commands.size !== 0) return;
    if (this.unavailable) this.stopLoop();
    else void this.cleanTeardown();
  }

  private async cleanTeardown(): Promise<void> {
    if (this.teardownStarted) return;
    this.teardownStarted = true;
    try {
      await this.room.storage.delete(ROOM_INSTANCE_MARKER);
      this.logger.event("room_clean_teardown");
    } catch (error) {
      this.logger.event("room_teardown_failed", { reason: String(error) });
    } finally {
      this.unavailable = true;
      this.stopLoop();
    }
  }

  private expirePendingHandshakes(): void {
    for (const [id, admittedAt] of this.pendingAt) {
      if (this.tick - admittedAt < HANDSHAKE_TTL_TICKS) continue;
      this.pendingConnections.get(id)?.close(1008, "join handshake timed out");
      this.logger.rejection("handshake_timeout", this.tick);
      this.pendingConnections.delete(id);
      this.pendingAt.delete(id);
    }
  }

  private simulate(): void {
    const all = Array.from(this.players.values());
    if (all.length === 0) return;
    this.flashlights.tick(DT, this.level === 1);
    for (const p of all) Object.assign(p, this.flashlights.state(p.id));
    const active = all.filter((player) => this.connections.has(player.id));
    if (active.length === 0) return;
    this.runS += DT;
    tickRevives(active, DT);

    const standing = active.filter((p) => !p.down);
    if (standing.length === 0) {
      this.setPhase("lost");
      return;
    }
    if (canNoclip(standing, this.maze, this.keys.length)) {
      if (this.level >= LAST_LEVEL) this.setPhase("won");
      else this.enterLevel(this.level + 1);
      return;
    }

    this.movement.step(active, this.maze, this.props, DT);

    // Always measure how loud everyone is: the players need to SEE the mechanic that is
    // hunting them, and the HUD reads this straight off the snapshot.
    for (const p of active) {
      if (p.down) {
        p.noise = 0;
        p.heard = false;
        continue;
      }
      const { made, reaching } = measurePlayerNoise({
        player: p,
        previous: this.prevPos.get(p.id),
        maze: this.maze,
        monster: this.monster,
        mic: this.mic.get(p.id) ?? 0,
        creaky: this.creaky,
        dt: DT,
      });
      this.prevPos.set(p.id, { x: p.x, z: p.z });
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
    tickMonsterEncounter({
      standing,
      monster: this.monster,
      maze: this.maze,
      director: this.director,
      reaching: this.reaching,
      rule,
      dark: this.outage.dark,
      dt: DT,
      rng: this.rng,
    });
  }

  private clearPlayerTransient(id: string): void {
    this.movement.disconnect(id);
    this.flashlights.disconnect(id);
    this.mic.delete(id);
    this.reaching.delete(id);
    const player = this.players.get(id);
    if (!player) return;
    player.noise = 0;
    player.heard = false;
    player.lit = false;
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.logger.event("phase_changed", { phase });
  }

  private broadcast(message: ServerMsg): void {
    const raw = encode(message);
    for (const connection of this.connections.values()) {
      if (connection.readyState === 1) connection.send(raw);
    }
  }
}
