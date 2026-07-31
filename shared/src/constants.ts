// Shared constants — single source of truth for both client and server.

export const TICK_HZ = 15;
export const TICK_MS = 1000 / TICK_HZ;

// Maze dimensions (cells) and world scale (units per cell).
export const MAZE_COLS = 12;
export const MAZE_ROWS = 12;
export const CELL = 4;
export const WALL_HEIGHT = 3;
export const WALL_THICKNESS = 0.3;

// Player physics (speeds per gameplay spec — docs/GAME-DESIGN.md).
export const PLAYER_RADIUS = 0.4;
export const EYE_HEIGHT = 1.6;
export const WALK_SPEED = 1.8;
export const SPRINT_SPEED = 3.6;
export const SPRINT_MS = 3000; // sprint budget
export const SPRINT_CD_MS = 5000; // cooldown after it drains
export const CROUCH_SPEED = 0.9; // silent

// Monster speeds (player walk = reference).
export const PATROL_SPEED = 1.5;
export const HUNT_SPEED = 3.9; // 108% of sprint — corners beat legs
export const LUNGE_SPEED = 8;
export const LUNGE_S = 0.8;
export const STAGGER_S = 2; // missed-lunge recovery = the escape window

// Director (Alien menace + L4D cycle + Eyeless Dog suspicion — see RESEARCH).
// Grace at the start of a level: the creature cannot catch you yet. Kept SHORT on purpose —
// "corridors where nothing happens" is the #1 boredom complaint players make about this genre,
// and a free browser game has no sunk cost to spend on dead air (docs/RESEARCH.md §player voices).
export const SPAWN_GRACE_S = 20;
export const HUNT_GRACE_S = 3; // roar first, kills after
export const HUNT_MAX_S = 30;
export const STALK_TIMEOUT_S = 45;
export const CALM_MIN_S = 40;
export const CALM_MAX_S = 70;
export const RETREAT_MIN_S = 25;
export const RETREAT_MAX_S = 40;
export const MENACE_NEAR_PER_S = 2; // monster audible-close to a player
export const MENACE_SEEN_PER_S = 4; // "LOS" ≈ near + unobstructed-ish
export const MENACE_DECAY_PER_S = 1.5;
export const MENACE_RETREAT_AT = 70; // pressure valve
export const SUSPICION_HUNT_AT = 9; // Eyeless Dog
export const SUSPICION_DECAY_EVERY_S = 4;
export const HEAR_RANGE = 25;

// Down / revive (2-player death rule).
export const REVIVE_DIST = 1.5;
export const REVIVE_S = 5;

// Level 1 — the flashlight dilemma + power outages.
export const FLASHLIGHT_S = 90; // bright-mode battery per level (Darkwood number)
export const LIT_RANGE = 12; // beam reach that counts against the monster
export const LIT_DOT = 0.8; // beam cone
export const LIT_SLOW = 0.15; // lit monster creeps — light is the weapon down here
export const DARK_HUNT_MULT = 1.3; // in its dark, it is faster than you
export const OUTAGE_EVERY_MIN_S = 45;
export const OUTAGE_EVERY_MAX_S = 70;
export const OUTAGE_S = 15;

// The microphone as input (Eyeless Dog tuning — see docs/RESEARCH.md §gameplay).
export const MIC_GATE = 0.25; // below this you are whispering: always safe
export const MIC_LOUD = 0.6; // talking normally
export const MIC_SCREAM = 0.85; // scream = instant hunt = the clip
export const MIC_HEAR_RANGE = 25; // beyond this it can't hear you at all
export const MIC_WALL_DAMP = 0.5; // per wall between you and it (capped at 2)

// Hunt feel.
export const CATCH_DIST = 0.9;
export const LUNGE_DIST = 4;
export const RUN_THRESHOLD = 1.5; // u/s that reads as "loud" footsteps
export const STARE_DOT = 0.86; // facing cone for the staring contest
export const STARE_SLOW = 0.35;

// Default PartyKit host for local dev. Override with ?host= or VITE_PARTY_HOST.
export const DEFAULT_PARTY_HOST = "127.0.0.1:1999";
