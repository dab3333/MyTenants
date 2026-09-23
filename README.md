# MyTenants

Self-hosted, multi-tenant property management app for landlords: buildings, floors, rooms, tenants, invoices/payments, and announcements. See `PRODUCT.md` for the product overview.

Monorepo layout:

- `apps/web` — Next.js 15 app (the UI + API routes)
- `apps/worker` — background cron jobs (e.g. marking invoices overdue)
- `packages/db` — Prisma schema, migrations, and the seed script, shared by both apps

## Running it on a remote machine (Docker)

This is the recommended way to run MyTenants on a server/VPS/home box. It only requires Docker — no Node.js install needed on the host.

### 1. Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose (bundled with modern Docker)
- Git
- If you want it reachable over the internet with a real domain: a DNS record pointing at the machine, and ports 80/443 open (Caddy will handle TLS automatically via Let's Encrypt)

### 2. Clone and configure

```bash
git clone https://github.com/dab3333/MyTenants.git
cd MyTenants
cp .env.example .env
```

Edit `.env`:

```
POSTGRES_PASSWORD=<pick a strong password>
AUTH_SECRET=<random 32+ byte value, e.g. `openssl rand -hex 32`>
DOMAIN=<your-domain.example.com, or leave as localhost for local/LAN use>
```

`AUTH_SECRET` signs login sessions — always set your own random value, never reuse the one from the repo's history.

### 3. Build and start

```bash
docker compose up -d --build
```

This starts four containers: `postgres`, `web`, `worker`, and `caddy`. Database migrations run automatically on `web`'s startup (`prisma migrate deploy`) — no manual migration step needed.

- If `DOMAIN` is a real domain pointed at this machine, the app is reachable at `https://<your-domain>` (Caddy provisions TLS automatically).
- Otherwise, it's reachable directly at `http://<machine-ip-or-localhost>:3000`, or via Caddy at `http://<machine-ip-or-localhost>` (port 80).

### 4. Create your first account

Visit `/signup` and create an organization + owner account. Then log in at `/login`.

### 5. (Optional) Seed demo data

To populate the app with realistic sample buildings, tenants, invoices, and announcements instead of starting empty:

```bash
docker compose exec web sh -c "pnpm --filter db seed"
```

This only runs if no demo user exists yet; it logs the demo login (`demo@mytenants.local` / `Demo12345!`) when done. It's meant for trying the app out, not production data — delete the demo user/org from the database if you want to remove it later.

### 6. (Optional) Real email delivery

By default, tenant announcement and rent-reminder emails just log to the `web`/`worker` containers' output instead of sending (no-op). Two ways to turn on real delivery — set whichever one in `.env`, then `docker compose up -d --build`:

**Gmail SMTP** (no domain required — good if you don't own one):

1. Turn on [2-Step Verification](https://myaccount.google.com/security) on the Gmail account you want to send from, then create an [App Password](https://myaccount.google.com/apppasswords).
2. Add to `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=you@gmail.com
   SMTP_PASS=<the 16-character app password>
   SMTP_FROM=MyTenants <you@gmail.com>
   ```
   Regular Gmail accounts cap out around 500 sends/day, which is generally plenty for a single landlord's tenant list.

**Resend** (requires a domain you can verify with them):

1. Add `RESEND_API_KEY=<your key>` to `.env`.
2. Update the hardcoded `FROM_ADDRESS` in `packages/db/src/emailSender.ts` to an address on your verified domain (the placeholder `notifications@mytenants.example` won't send).

If both `SMTP_*` and `RESEND_API_KEY` are set, SMTP takes priority.

### Updating to a new version

```bash
git pull
docker compose up -d --build
```

### Data persistence

Postgres data, uploaded tenant photos, and Caddy's TLS certificates are stored in named Docker volumes (`postgres_data`, `tenant_uploads`, `caddy_data`), so they survive `docker compose down` and rebuilds. Only `docker compose down -v` (or manually removing the volumes) deletes them — back up `postgres_data` before doing that if you need the data.

### Stopping / logs

```bash
docker compose stop          # stop containers, keep data
docker compose logs -f web   # tail the app's logs
```

## Local development (without Docker)

Requires Node.js 20+ and pnpm 9.

```bash
pnpm install

# Postgres for local dev — either run one yourself, or start just the DB via Docker:
docker compose up -d postgres
```

Each of `apps/web` and `packages/db` needs a `.env` with:

```
DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD from your .env>@localhost:5432/mytenants"
AUTH_SECRET="replace-with-a-random-32-byte-value"
```

(Note: the Dockerized Postgres isn't exposed on `localhost:5432` by default in `docker-compose.yml` — either add a `ports: ["5432:5432"]` mapping to the `postgres` service for local dev, or point `DATABASE_URL` at your own local Postgres instance.)

Then:

```bash
pnpm --filter db prisma:generate
pnpm --filter db prisma:migrate
pnpm --filter db seed        # optional demo data

pnpm dev                     # starts apps/web on http://localhost:3000
```

Running the test suites:

```bash
pnpm test                    # vitest across web, db, and worker
cd apps/web && npx playwright test   # e2e tests (needs the dev server + a running Postgres)
```
