# Deploying to the Hostinger VPS

Assumes the same pattern as your other Compose projects (n8n, Traefik) --
this app joins the shared `root_default` network and gets routed by your
existing Traefik instance, no new host ports exposed.

## 1. Push to GitHub (local machine)

```bash
cd gingin-forecast
git init
git add .
git commit -m "Initial commit"
gh repo create gingin-forecast --private --source=. --push
# or: create the repo on github.com first, then
#   git remote add origin git@github.com:your-org/gingin-forecast.git
#   git push -u origin main
```

`.gitignore` already excludes `node_modules`, `.next`, and `.env` -- your
real database password never gets committed.

## 2. On the VPS: clone and configure

```bash
cd /path/to/your/compose/projects
git clone git@github.com:your-org/gingin-forecast.git
cd gingin-forecast
cp .env.prod.example .env
nano .env   # set a real DB_PASSWORD, and DOMAIN to the subdomain you'll use
```

Point DNS for that subdomain at the VPS (an A record to its IP) before the
next step, since Traefik/Let's Encrypt needs it resolvable to issue a
certificate.

## 3. Build and bring up the database first

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d db
```

## 4. Run migrations and the first data import

These run through a separate one-off service (`migrate`) that keeps the
full toolchain the slim production image doesn't carry:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate npx prisma migrate deploy
docker compose -f docker-compose.prod.yml run --rm migrate npm run import
```

## 5. Bring up the app

```bash
docker compose -f docker-compose.prod.yml up -d app
```

Traefik should pick up the labels automatically and issue a certificate for
`DOMAIN` within a minute or two. Check `docker compose -f docker-compose.prod.yml logs -f app`
if it doesn't come up.

## 6. Keeping data fresh

For now, re-run the import manually after dropping a new file into `data/`:

```bash
git pull
docker compose -f docker-compose.prod.yml build migrate
docker compose -f docker-compose.prod.yml run --rm migrate npm run import
```

Once the source is a live Google Sheet (`SOURCE_REF` set to its published
CSV URL in `.env`), automate this instead with a cron entry on the VPS:

```
0 6 * * * cd /path/to/gingin-forecast && docker compose -f docker-compose.prod.yml run --rm migrate npm run import >> /var/log/gingin-import.log 2>&1
```

## 7. Redeploying after code changes

```bash
git pull
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
```

If a schema change shipped too, run the migrate step (step 4, first command)
before bringing the app back up.

## Troubleshooting

- **Traefik isn't routing to it** -- check the entrypoint/certresolver names
  in `docker-compose.prod.yml`'s labels match what your existing Traefik
  container actually uses (look at the labels on a working service like
  the Revvy tracker's Compose file for the exact names).
- **App container exits immediately** -- check `DATABASE_URL` in `.env`
  resolves; `docker compose -f docker-compose.prod.yml logs app`.
- **"Query Engine not found" at runtime** -- means the Prisma engine binary
  didn't make it into the slim runtime image. The Dockerfile already copies
  `node_modules/.prisma` explicitly to guard against this, but if it
  happens, rebuild with `--no-cache` once.
