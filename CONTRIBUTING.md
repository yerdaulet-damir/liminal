# Contributing to Liminal

Thanks for helping make the maze stranger and more reliable. Small, focused
changes are easiest to review.

## Before you start

- Read `AGENTS.md`. Its authority, protocol, and determinism rules are hard
  constraints, not style suggestions.
- Open an issue before a large feature, stack change, wire-protocol change, or
  asset replacement.
- Do not add assets without documented provenance and redistribution rights.

## Local setup

Use the pinned Node and pnpm versions:

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

The example production hostnames are placeholders. Local development falls
back to `localhost`; a production build deliberately does not.

## Pull requests

1. Branch from `main` and keep the change scoped.
2. Add or update tests for behavior changes.
3. Run `pnpm check:assets`, `pnpm test`, `pnpm typecheck`, and a production
   build as described in `DEPLOYMENT.md`.
4. Explain player-visible effects, authority implications, and manual checks.
5. Do not commit secrets, `.env.local`, generated build output, or private
   planning documents.

Commit messages should be short, imperative, and explain the outcome (for
example, `fix: reject invalid production hosts`). By contributing, you agree
that your contribution is licensed under the repository MIT License. Assets
remain subject to the per-file terms in `ASSETS.md`.
