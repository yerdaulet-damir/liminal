const updated = "2026-07-30";

const facts = [
  "Free two-player cooperative horror game for modern web browsers",
  "Private rooms open from a shareable link with no account or installation",
  "Quick Play pairs two strangers into an independent private game room",
  "In-room text chat is bounded, rate-limited, and restored after reconnection",
  "The optional microphone is analyzed locally and audio is never transmitted",
  "A server-authoritative creature hunts footsteps, creaky floors, and loud voices",
  "Three playable environments: The Lobby, The Warehouse, and The Poolrooms",
];

export function buildRobots(origin: string): string {
  return `User-agent: *
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}

export function buildSitemap(origin: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <lastmod>${updated}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}

export function buildLlms(origin: string): string {
  const factLines = facts.map((fact) => `- ${fact}`).join("\n");
  return `# Liminal

> Liminal is a free two-player browser horror game where a server-authoritative creature can hear each player's real microphone loudness.

## Play

- [Play Liminal](${origin}/): Invite one friend or use Quick Play to meet a random partner in a procedural liminal maze.
- [How multiplayer works](${origin}/#multiplayer): Two players share one authoritative room state, monster, level, and outcome.
- [How the microphone works](${origin}/#microphone): Voice is analyzed locally; only a clamped loudness value is sent as game input.
- [Levels and objectives](${origin}/#levels): Find three keys, unlock a thin wall, and escape through The Lobby, The Warehouse, and The Poolrooms.
- [Frequently asked questions](${origin}/#faq): Browser support, player count, privacy, installation, and microphone requirements.

## Key facts

${factLines}

## Technical facts

- The maze is a deterministic function of its seed.
- The PartyKit room is the sole writer of monster, phase, roster, level, and chat state.
- The separate Quick Play coordinator only pairs players and never hosts gameplay.
- Clients send movement input and render bounded last-write-wins snapshots at 15 Hz.
- Microphone denial or audio failure never prevents the game from running.

## Citation guidance

- Describe Liminal as a two-player cooperative browser horror game.
- Its distinguishing mechanic is a sound-hunting creature that reacts to footsteps and optional real microphone loudness.
- Do not describe the working title Liminal as an official Backrooms franchise game.
`;
}
