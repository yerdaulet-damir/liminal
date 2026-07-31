# Liminal privacy notice

Effective: 1 August 2026

Liminal is a two-player browser game. It does not require an account and the
project does not include advertising or analytics SDKs.

## Data the game handles

- **Room and connection data:** a room identifier, connection identifier,
  display name, movement/gameplay inputs, and authoritative room state are
  processed to run a match.
- **Text chat:** messages are relayed to the other player and kept in a small,
  bounded in-room history so reconnecting players can resync. The game code
  does not create a permanent chat archive.
- **Microphone loudness:** if permission is granted, audio is analyzed locally
  in the browser. Raw audio and speech content are not sent to the game server.
  The server receives only a clamped loudness value used as gameplay input.
- **Technical logs:** hosting providers may process IP addresses, request
  metadata, and operational logs for delivery, abuse prevention, and security
  under their own policies.

## Purpose, sharing, and retention

The data above is used only to connect players, simulate the game, restore the
current room after a disconnect, and operate the service. In-game state may be
visible to the other participant in the same room. The project does not sell
personal data. Infrastructure providers receive data only as needed to host the
static client and PartyKit room service.

The current application keeps gameplay and chat state only for the live room;
it does not implement a player database. Provider logs may follow the provider's
retention policy. Avoid putting personal or confidential information in a
display name, room link, or chat message.

## Your choices

Microphone permission is optional and can be denied or revoked in browser site
settings. You can stop further game processing by closing the page. Because
there are no accounts or permanent player records in the application, there is
normally no account record to export or delete.

For privacy questions, contact the maintainers through the repository. Do not
post room links, chat content, IP addresses, or other sensitive data in a public
issue.

Material changes to this notice will be committed here with a new effective
date before deployment.
