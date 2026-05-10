# Fléchettas

Fléchettas is a fast, local-first darts scoring PWA built for match nights where the phone is the scoreboard and everyone can follow along.

It works offline for solo/local play, supports shared sessions without accounts, and keeps the scoring flow focused on the next dart instead of admin screens.

## Highlights

- **Local-first scoring**: active games are kept on the device so a refresh does not lose the match.
- **Shared sessions**: create a short code or invite link so multiple players can join the same table.
- **Multiple game modes**: X01, Cricket, Shanghai, Killer, Around the Clock, Bobs 27, Checkout 121, and training modes.
- **PWA-ready**: installable, touch-friendly, responsive, and designed for mobile scoring.
- **Match history and stats**: save completed games and review player performance later.
- **Checkout help**: compact finish suggestions appear when an X01 checkout route is available.
- **No accounts required**: a session code is the capability token for shared play.

## Tech Stack

- **Framework**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI primitives
- **State and storage**: Zustand, Dexie/IndexedDB
- **Shared sessions**: SQLite with `better-sqlite3`
- **PWA**: Serwist service worker integration

## Quick Start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

By default, shared-session SQLite data is stored in `data/flechettas.sqlite`. Override it with either `SQLITE_PATH` or `DATABASE_PATH`:

```bash
SQLITE_PATH=./data/flechettas.sqlite pnpm dev
```

## Useful Commands

```bash
pnpm dev
pnpm lint
pnpm exec tsc --noEmit
pnpm build
pnpm start
```

## Deployment Notes

Shared sessions are intentionally no-login: the session code is the access token. For production, keep the SQLite deployment single-writer and persistent:

- Run one Node.js app instance per SQLite database file.
- Mount a persistent volume for the database directory.
- Set `SQLITE_PATH` or `DATABASE_PATH` to a path inside that volume, for example `/data/flechettas.sqlite`.
- Keep `HOSTNAME=0.0.0.0` when running the standalone Next server in Docker/Dokploy.

Recommended Dokploy environment:

```bash
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
SQLITE_PATH=/data/flechettas.sqlite
NIXPACKS_NODE_VERSION=22
NIXPACKS_INSTALL_CMD=pnpm install --frozen-lockfile --prod=false --config.optional=true --force
NIXPACKS_BUILD_CMD=pnpm build && cp -r public .next/standalone/public && mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/static
NIXPACKS_START_CMD=node .next/standalone/server.js
```

Mount `/data` before enabling shared sessions. Do not scale horizontally against the same SQLite file unless a single-writer architecture is added.

## License

Fléchettas is released under the [MIT License](LICENSE).
