# Gingin Forecast

Weekly stock-on-hand forecasting dashboard. Predicts next week's demand per
product from order history so production (the Friday meat cut) can be
planned ahead of Monday's stock need.

## Stack

- **Next.js 14** (App Router) — frontend + API routes
- **Postgres** via **Prisma** — orders, order items, dashboard column config
- **Plain Node/TypeScript importer** — no orchestration tool required
- Tailwind CSS for styling

## Why it's built to swap data sources without a rewrite

Two things were built flexible on purpose, because you said the real data
(and possibly a Google Sheets source) is coming later:

1. **Where data comes from** — `src/lib/dataSource/`. One interface
   (`OrderSource`), one implementation (`TabularOrderSource`) that reads
   either a local `.xlsx`/`.csv` file or a URL that returns CSV — which is
   exactly what a Google Sheet's "Publish to web → CSV" link gives you.
   Switching from the demo file to a live sheet is a one-line env var
   change (`SOURCE_REF`), not a code change.

2. **What column names the source uses** —
   `src/lib/dataSource/headerAliases.ts`. The importer doesn't assume your
   real export's headers exactly match the demo file's. It matches against
   a list of known aliases per field ("Order Date", "order_date", "Date"
   all resolve to the same thing). If a future source uses a header
   nobody's seen yet, add it to that list — no other code changes.

3. **What columns the dashboard shows** — stored in the `DashboardColumn`
   table, not hardcoded in the React components. `GET /api/columns` reads
   it, `PATCH /api/columns` reorders/hides/relabels. The forecast table
   renders whatever comes back. Add a new computed metric to
   `src/lib/forecast.ts`'s output and it becomes available as a column
   without touching the table component.

## Setup

```bash
npm install
cp .env.example .env
docker compose up -d          # starts Postgres on localhost:5433
npx prisma migrate deploy     # applies migrations already in prisma/migrations -- never generates new ones locally
npm run import:monthly        # or import:weekly, depending which source you're testing against
npm run dev                   # http://localhost:3000
```

**Important: never run `npx prisma migrate dev` on a local machine for this project.**
New migrations should only ever be generated directly against the VPS's real
database (the actual source of truth), then committed and pushed from
there. Running `migrate dev` locally generates a full competing migration
history that collides with the VPS's when you push it -- this has broken
a production deploy multiple times already. If your local schema and
database fall out of sync, use `npx prisma migrate reset` instead --
it wipes your *local* database and cleanly reapplies whatever migrations
already exist in git, without ever creating new ones.

## Moving to real / live data

1. Get the real export (needs an order date column — see note below) or the
   Google Sheet's published CSV link.
2. Update `SOURCE_REF` in `.env`.
3. Run `npm run import` (or hit `POST /api/import`).
4. If the source uses column headers we haven't seen, the import will tell
   you exactly which required field it couldn't find — add the header name
   to `HEADER_ALIASES` in `src/lib/dataSource/headerAliases.ts`.

To keep it fresh automatically once the source is a live Google Sheet, put
`POST http://your-server/api/import` on a schedule (system cron, or
whatever scheduler your VPS already runs) — no new service needed.

## The forecast model

For each product: trailing 4-week average vs the prior 4-week average gives
a growth %. Recommended stock = trailing average × (1 + growth) × scenario
levers × safety buffer. It's intentionally a transparent calculation, not a
black box — anyone locking Friday's production numbers needs to see *why*
a number came out the way it did. `src/lib/forecast.ts` is the one place
that logic lives; year-over-year seasonality is the natural next addition
once there's 12+ months of real history.

## Known limitation carried over from the current data

The original client export has no order-date column at all. The demo data
in `data/orders-with-dates.xlsx` has synthetic (but internally consistent)
dates assigned — see the chat history for how. Real dated data is a direct
drop-in replacement; nothing else needs to change.

## Pages

- `/` — KPI overview, top products, category mix
- `/forecast` — full sortable/filterable/searchable forecast table, CSV export, click a row for a weekly trend drawer
- `/scenario` — what-if sliders (demand shift, promo boost, safety buffer) showing total stock impact
- `/alerts` — auto-flagged products (declining, unusually high growth, insufficient data)
