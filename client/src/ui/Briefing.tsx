// The briefing card. Shown once when you arrive somewhere new: what this place is, what it
// wants from you, and the one rule that will get you killed if nobody says it out loud.
// Text comes from shared/lore so the landing page, the game and the docs never disagree.

import { useEffect, useState } from "react";
import { CORE_RULES, OPENING, levelLore } from "@liminal/shared";
import "./briefing.css";

const FIRST_CARD_MS = 13_000;
const LEVEL_CARD_MS = 9_000;

export function Briefing({ level, active }: { level: number; active: boolean }) {
  const [shown, setShown] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    setShown(level);
    setLeaving(false);
    const life = level === 0 ? FIRST_CARD_MS : LEVEL_CARD_MS;
    const fade = setTimeout(() => setLeaving(true), life - 600);
    const hide = setTimeout(() => setShown(null), life);
    return () => {
      clearTimeout(fade);
      clearTimeout(hide);
    };
  }, [level, active]);

  if (shown === null) return null;
  const lore = levelLore(shown);
  const first = shown === 0;

  return (
    <aside className={`briefing${leaving ? " briefing--leaving" : ""}`} aria-live="polite">
      <p className="briefing__numeral">{lore.numeral}</p>
      <h2 className="briefing__name">{lore.name}</h2>
      <p className="briefing__flavor">{first ? OPENING.body : lore.flavor}</p>

      <p className="briefing__label">Your task</p>
      <p className="briefing__objective">{lore.objective}</p>

      <ul className="briefing__rules">
        {(first ? [OPENING.rule, ...CORE_RULES.slice(0, 3)] : lore.rules).map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>

      <p className="briefing__tip">{lore.tip}</p>
    </aside>
  );
}
