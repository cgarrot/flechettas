# Fléchettas

Fléchettas is a local-first darts scoring PWA built with Next.js. Shared sessions use a small SQLite database on the server so players can join the same game by code or URL without creating accounts.

## Getting Started

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

By default, local SQLite data is stored in `data/flechettas.sqlite`. You can override it with `SQLITE_PATH` or `DATABASE_PATH`:

```bash
SQLITE_PATH=./data/flechettas.sqlite pnpm dev
```

## SQLite deployment notes

Shared sessions are intentionally no-login: the session code is the capability token. Keep deployments single-writer and persistent:

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

Mount `/data` as a persistent volume before enabling shared sessions in production. Do not scale the app horizontally against the same SQLite file unless a single-writer architecture is added.

## Verification

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```
