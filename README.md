# Liminal

> Working title for a free two-player browser horror game.

![Two players face a distant creature in an endless yellow office maze](client/public/liminal-key-art.webp)

**Send a friend one link. Find three keys. Stay quiet. The creature hears footsteps, creaky floors, and your real microphone loudness.**

Liminal is a playable cooperative horror game built for the browser. There is no account, installation, or shared open world. Invite one friend or use Quick Play to meet a random partner; each pair enters one server-authoritative room with the same deterministic maze, creature, level, and outcome.

The project is not affiliated with an official Backrooms franchise. It uses original characters and the generic liminal-space horror theme.

## What is playable now

| System | Current build |
|---|---|
| Multiplayer | Two players join through a private URL or random Quick Play matchmaking |
| Chat | Bounded, server-relayed text chat with reconnect resync |
| Run structure | The Lobby, The Warehouse, and The Poolrooms |
| Objective | Find three seeded keys, unlock the thin wall, and move together |
| Threat | One server-authoritative creature with level-specific rules |
| Sound | Footsteps, creaky floors, and optional microphone loudness feed one hearing model |
| Failure | Players can be downed, revived, or lose the run together |
| Recovery | Reconnection restores the latest authoritative snapshot |
| Entry | No login; create an invite or enter the random matchmaking queue |

Desktop browsers are the current target. Mouse-look and keyboard controls are implemented; mobile touch controls are not.

## The run

### The Lobby

Yellow wallpaper, damp carpet, fluorescent hum, and dead ends containing the keys. The listener is blind but hunts the loudest sound. Whispering is safe; sprinting, creaky floorboards, and shouting are not.

### The Warehouse

Concrete, crates, fog, a finite flashlight, and seeded power outages. In darkness the creature accelerates. A correctly aimed flashlight slows it and blocks its lunge.

### The Poolrooms

White tile, shallow water, and no active creature. This is the quiet final space before escape.

Every level is derived from the room seed. Both players and the server build the same byte-stable layout. All standing players must reach the unlocked thin wall before the room advances.

## The microphone is an input, not voice chat

The browser analyzes microphone amplitude locally with the Web Audio API. Raw audio is never transmitted or recorded. The client sends one clamped loudness value through the existing typed movement message.

Microphone permission is optional:

- Allow it and the creature can hear loud speech.
- Deny it and the creature still hears movement and creaky floors.
- Audio failure never stops the room, simulation, or reconnection.

Players can use the built-in text chat or keep Discord open alongside the game. Built-in proximity voice chat is not shipped yet.

## Why the multiplayer stays in sync

```text
player input
    ↓
shared/protocol validates the message
    ↓
PartyKit room tick is the sole writer
    ↓
bounded authoritative snapshot at 15 Hz
    ↓
clients interpolate and render
```

- **One writer:** monster, roster, level, phase, keys, outages, chat history, and outcomes belong to the room tick.
- **One matchmaker:** the Quick Play coordinator pairs two tickets and returns an opaque room ID; it never hosts gameplay.
- **One maze:** `generate(seed)` is pure and guarded by determinism tests.
- **One wire contract:** every client and room message passes through `shared/protocol`.
- **Snapshot recovery:** state is last-write-wins, so the next snapshot repairs a dropped or reordered packet.
- **Horizontal rooms:** 10,000 online players means 5,000 independent two-player rooms, not one shared world.

## Run locally

Requirements: Node.js, pnpm 11, and a browser with WebGL2.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173), enter a name, and choose **Quick Play** to meet a random partner. To play with a friend, create a private game and open the copied invite in another browser window or device:

```text
http://<your-mac-lan-ip>:5173/?room=<room-id>&host=<your-mac-lan-ip>:1999
```

Controls:

| Input | Action |
|---|---|
| Mouse | Look |
| WASD | Move |
| Shift | Short loud sprint |
| C | Silent crouch |
| F | Flashlight in The Warehouse |
| Enter | Open text chat |
| Escape | Release pointer lock |

Useful visual-development routes:

```text
?level=0   preview The Lobby
?level=1   preview The Warehouse
?level=2   preview The Poolrooms
?watch=1   follow the creature
?shim=1    keep rendering in headless screenshot sessions
```

## Verify

```bash
pnpm test
pnpm typecheck
pnpm --filter client build
```

The workspace suites cover protocol validation, matchmaking idempotency, two-player admission, bounded chat/resync, procgen hashes, connectivity, collision, item placement, hearing, director pressure, and monster rules.

## Deploy

The game client is a static Vite build and the authoritative room runs on PartyKit.

```bash
pnpm --filter party deploy
VITE_PUBLIC_ORIGIN=https://your-domain.example \
  VITE_PARTY_HOST=<party-name>.<account>.partykit.dev \
  pnpm --filter client build
```

`VITE_PUBLIC_ORIGIN` is required for correct canonical URLs, Open Graph metadata, `sitemap.xml`, and `llms.txt`. The Vite build emits:

- `/robots.txt` with search and AI crawler access;
- `/sitemap.xml` with the canonical playable page;
- `/llms.txt` with concise facts and citation guidance;
- static HTML copy for crawlers that do not execute the React/WebGL application;
- `VideoGame`, `WebSite`, and `FAQPage` JSON-LD in the document head.

After deployment, submit the sitemap to Google Search Console and Bing Webmaster Tools. Check that all three generated crawler files return HTTP 200 from the final domain.

## Repository map

```text
client/
  src/ui/       landing, lobby, HUD, outcome screens
  src/scene/    level geometry, lighting, props, actors
  src/player/   first-person input, camera, collision
  src/net/      socket boundary and received state
  src/audio/    microphone analysis and horror sound

party/
  src/room.ts   authoritative room tick and state
  src/chat.ts   bounded authoritative room chat
  src/matchmaking/ random two-player pairing coordinator
  src/levels.ts level rules
  src/outage.ts seeded outage state machine

shared/
  src/protocol.ts typed and validated wire messages
  src/procgen.ts deterministic maze generation
  src/hearing.ts one sound model for movement and voice
  src/monster.ts pure monster rules
  src/items.ts   seeded keys and creaky floors

docs/           product, research, design, monetization, and decisions
```

## Canonical facts for search and AI answers

- Liminal is a two-player cooperative browser horror game.
- It requires no installation or player account.
- Players can enter through a private invite or random two-player Quick Play.
- Text chat is server-relayed, rate-limited, bounded to recent messages, and restored on reconnect.
- Its distinguishing mechanic is a creature that reacts to movement and optional real microphone loudness.
- Raw microphone audio is never transmitted.
- The current run contains three environments: The Lobby, The Warehouse, and The Poolrooms.
- The server owns the creature and game outcome; clients send input and render snapshots.
- The maze is deterministically generated from a seed.

These facts are also published in the generated `/llms.txt`. The working title, public domain, and final production URL still require a launch decision before commercial release.

## Assets and attribution

| Asset | Source | License |
|---|---|---|
| Adventurer player characters | [KayKit Character Pack: Adventurers](https://github.com/KayKit-Game-Assets) | CC0 |
| Creep creature | Quaternius Ultimate Monsters | CC0 |
| Furniture and warehouse props | KayKit Furniture Bits and Dungeon Remastered | CC0 |
| Wallpaper, carpet, ceiling, concrete, and pool tiles | [ambientCG](https://ambientcg.com) | CC0 |
| Hum, roar, breathing, scream, and water source clips | [Freesound](https://freesound.org/) | CC0 sources |
| Landing key art | Original image generated for this project with OpenAI image generation | Project asset |

Detailed texture attribution is kept in [`client/public/textures/LICENSE.txt`](client/public/textures/LICENSE.txt). Product decisions and evidence live in [`docs/`](docs/README.md).
