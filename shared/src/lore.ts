// The fiction, in one place. The landing page, the in-game briefings and the docs all read
// from here, so the game never contradicts itself about its own world.

export interface LevelLore {
  /** Roman numeral shown on the briefing card. */
  numeral: string;
  name: string;
  /** One line of world, spoken by the place itself. */
  flavor: string;
  /** What the players must actually do, plainly. */
  objective: string;
  /** The one thing that will kill them if nobody says it out loud. */
  tip: string;
  /** Extra rules that only exist on this floor. */
  rules: readonly string[];
}

export const OPENING = {
  title: "You noclipped out of reality",
  body:
    "Nobody agrees on how it happens. You lean on a wall that was never load-bearing, you take a " +
    "corner that was not there yesterday, and the floor lets you through. What is on the other side " +
    "is not a place. It is the idea of a place, left running with nobody in it.",
  rule: "Nothing hunts you for the first twenty seconds. That is all the peace this place offers.",
} as const;

export const LEVELS_LORE: readonly LevelLore[] = [
  {
    numeral: "I",
    name: "The Lobby",
    flavor:
      "Six hundred million square miles of yellow wallpaper and damp carpet, lit by fluorescents " +
      "that nobody pays for. The hum is not in your head. Everything here was built for people who " +
      "never arrived.",
    objective: "Find three keys. They are dropped in dead ends, where you have to turn your back to leave.",
    tip: "It is blind. It only knows the noise you make — and whispering is always safe.",
    rules: [
      "Crouch is silent. Walking is heard nearby. Sprinting is heard from a long way off.",
      "Some floorboards creak. You will not know which until you hurry across one.",
      "Look straight at it and it slows down. That is your partner's window to run.",
    ],
  },
  {
    numeral: "II",
    name: "The Warehouse",
    flavor:
      "The concrete under the office. Crates nobody shipped, fog with no weather to come from, and " +
      "lights on a circuit that fails on its own schedule. Something down here learned what a " +
      "flashlight means.",
    objective: "Three more keys, in the dark this time. Your torch holds ninety seconds of bright.",
    tip: "The beam pins it in place — but a blackout makes it faster than you can run.",
    rules: [
      "Power fails on its own timer. When it does, the dark belongs to the creature.",
      "Light stops its lunge. Ninety seconds of battery for the whole floor: spend it, do not hold it.",
      "One of you should carry the light. The other should carry the plan.",
    ],
  },
  {
    numeral: "III",
    name: "The Poolrooms",
    flavor:
      "Warm tile, shallow water, and daylight from a sky that is not above anything. There is no " +
      "chlorine, no drain, no reason for it to be clean. It is the most beautiful room you will ever " +
      "want to leave.",
    objective: "Three last keys. Then find the thin wall together and go home.",
    tip: "Nothing lives here. That is not the same as being safe, but tonight it is close enough.",
    rules: [
      "No creature, no blackouts. Breathe.",
      "Sound still carries over water — you just have nothing to hide from.",
      "Both of you must reach the wall. Nobody leaves alone.",
    ],
  },
  {
    numeral: "IV",
    name: "The Dead Mall",
    flavor:
      "The skylights still perform daylight for stores that have forgotten their names. Plastic " +
      "palms gather dust around a dry fountain. Somewhere behind the shutters, a mannequin is " +
      "waiting for both of you to look away.",
    objective: "Search the atrium, food court, storefront loop, and service wing for three final keys.",
    tip: "It cannot move while either of you is looking directly at it. Blink together and it gets closer.",
    rules: [
      "One player watches the mannequin while the other searches. Trade places before panic wins.",
      "The atrium gives you long sightlines. The service corridors take them away.",
      "A corner breaks your gaze. Say it before you turn.",
    ],
  },
];

/** Rules that hold everywhere, for the tutorial card and the docs. */
export const CORE_RULES: readonly string[] = [
  "The way out is a wall until you have all three keys. Then it flickers and hums.",
  "Both players have to be at the thin wall for it to let you through.",
  "If it catches you, you go down — you do not die. Your partner has to reach you and hold still.",
  "It hears footsteps, creaky floors, and your real microphone. It never sees you.",
  "Scream and it will come. That is not a bug, that is the whole game.",
];

export const levelLore = (level: number): LevelLore =>
  LEVELS_LORE[Math.min(Math.max(level, 0), LEVELS_LORE.length - 1)]!;
