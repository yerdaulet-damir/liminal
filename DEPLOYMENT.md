# Deployment runbook

The browser client is a static Vite build for Cloudflare Pages. Gameplay rooms
and matchmaking deploy through PartyKit. Use separate preview and production
projects so a test worker cannot receive production players.

## Required public environment

```dotenv
VITE_PUBLIC_ORIGIN=https://play.example.com
VITE_PARTY_HOST=liminal.account.partykit.dev
```

Both variables are browser-visible. Never put secrets in a `VITE_*` variable.
Production builds reject missing values, HTTP origins, localhost, URL paths,
and PartyKit hosts containing a scheme or port.

## Preflight

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check:assets
pnpm check:secrets
pnpm audit --prod --audit-level=high
pnpm test
pnpm typecheck
VITE_PUBLIC_ORIGIN=https://play.example.com \
VITE_PARTY_HOST=liminal.account.partykit.dev \
pnpm build
```

The static output is `client/dist`. The build also generates `robots.txt`,
`sitemap.xml`, `llms.txt`, and `_headers`. The latter contains security/cache
rules and a CSP whose `connect-src` is restricted to the configured PartyKit
hostname.

## PartyKit

Authenticate with the intended PartyKit/Cloudflare account and deploy from a
clean, reviewed commit:

```bash
pnpm --filter party deploy
```

Record the resulting hostname as `VITE_PARTY_HOST`, then build/deploy the client.
The worker is authoritative and should be deployed before a client that expects
a new wire contract.

## Cloudflare Pages

Connect the repository with these settings:

- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Build output directory: `client/dist`
- Node version: `22.14.0`
- Environment variables: the two public variables above

Cloudflare should run builds only after GitHub CI passes. Keep production
credentials in Cloudflare/PartyKit settings, never in repository files.

## Post-deploy smoke test

1. Confirm `/`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, key art, and a model
   return `200` over HTTPS with the expected security headers.
2. Open a private room in two independent browser profiles and complete join,
   movement, chat, disconnect/reconnect, keys, and level transition.
3. Deny microphone permission and confirm gameplay continues; then grant it and
   verify only the loudness mechanic changes.
4. Test Quick Play with two profiles and confirm a third player cannot enter the
   resulting gameplay room.
5. Check browser console errors, PartyKit logs, and the final canonical/OG URLs.

Rollback the static client to the preceding Pages deployment and redeploy the
preceding PartyKit commit if the smoke test fails. Keep compatible client/server
commits paired in the release notes.
