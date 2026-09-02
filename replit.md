# GoTaxi SaaS Platform

GoTaxi is a multi-tenant SaaS platform for transportation and delivery businesses (food, e-commerce, ride-sharing, corporate, encomendas, services).

## Run & Operate

| Command | Purpose |
|---|---|
| `pnpm run typecheck` | Full monorepo typecheck (all packages) |
| `pnpm --filter @workspace/db run push` | Push schema to dev DB |
| `pnpm --filter @workspace/scripts run seed-pdv` | Seed PDV demo data |
| `pnpm -r run build` | Build all packages |

Required env vars: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_MAPS_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `EXPO_PUBLIC_DOMAIN`

## Stack

- **Runtime**: Node 24, TypeScript 5.9, pnpm workspaces
- **Backend**: Express 5, Drizzle ORM + PostgreSQL, Zod/v4
- **Web**: React 18, Vite, Tailwind CSS, shadcn/ui
- **Mobile**: Expo SDK 54, Expo Router (file-based), React Native
- **Codegen**: Orval (OpenAPI → Zod + React Query hooks)

## Where things live

```
artifacts/
  api-server/src/routes/   — all API routes (Express)
  pdv/src/                 — partner web app (React+Vite)
  admin/src/               — super-admin web app
  afiliados-hub/src/       — affiliate hub web app
  saas-mobile/             — Expo mobile app (pro + cliente flows)
lib/
  db/src/schema.ts         — Drizzle schema (source of truth)
  api-zod/src/index.ts     — generated Zod schemas
  api-spec/                — OpenAPI 3.1 spec
scripts/src/               — one-off scripts (seed, migrations)
```

## Architecture decisions

- **Multi-tenancy via `x-empresa-id` header** — all PDV/mobile requests carry this alongside JWT
- **SSE for real-time orders** — `GET /api/pdv/stream?empresaId=X` pushes `novo_pedido` / `status_atualizado` events
- **Lazy module tables** — service/carona tables are created on first access, avoiding schema coupling
- **`requireAdmin` middleware** returns `: void`; uses block-style early returns to satisfy TS7030 (no implicit returns)
- **Drizzle `numeric` columns** stored as strings — PDV inserts cast with `String(Number(...))` to avoid TS2769
- **`PlacePrediction`** uses `placeId` (camelCase) not `place_id` — Google Places proxy normalizes this

## Product

- **PDV**: POS, orders, products, reports, ride-sharing, encomendas, viagens pages for partners
- **Mobile (Pro)**: Motorista/entregador app with GPS, dispatch, earnings, PIX payout
- **Mobile (Cliente)**: Customer ordering, food/delivery, ride booking, affiliate referral
- **Admin**: Super-admin control over empresas, drivers, modules, repasse
- **Afiliados Hub**: Affiliate registration, commissions, QR codes, analytics
- **API Server**: All backend logic, multi-module routing, SSE, Google Maps proxy

## User preferences

- Iterative development — ask before major changes
- Do not touch folder `Z` or file `Y`

## Gotchas

- `pnpm run typecheck` runs `typecheck:libs` first (tsc project references), then per-package — must pass both
- `scripts/` needs `drizzle-orm` as a direct dependency (not just via `@workspace/db` re-export)
- `AuthState` in PDV does NOT have `empresaId` directly — access via `user?.empresaId`
- `headers` passed to `fetch()` must be typed `Record<string, string>` (not inferred union with `undefined` values)
- Mobile `register()` interface must match implementation signature (4 params, 4th optional)
- `ProUser` interface in `ProAuthContext.tsx` is the source of truth for mobile pro user shape
