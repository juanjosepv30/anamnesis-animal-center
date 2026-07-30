# Proposal: Migrate Animal Center to FastAPI + Next.js + PostgreSQL

## Intent

The live clinic system is one GAS Web App over Sheets-as-DB. It has **no staff auth** (any device can impersonate any doctor), plaintext PINs, records addressed by spreadsheet row index, runtime self-healing schema, `LockService` instead of transactions, and 2-3s polling. It cannot be safely extended. Move to a real stack without losing production behavior or history.

## Scope

### In Scope

- **Schema + migrations**: normalize `Medicos` → `doctors` / `doctor_specialties` / `doctor_commission_rates`; `Comisiones` JSON blob → child table; stable PKs replace row indexes; TZ-aware `America/Bogota` (rewrite, do not port the string hacks).
- **Historical ETL**: one-time migration of visits, appointments, reviews, commissions.
- **Staff auth** (NEW capability): hashed credentials, session/JWT, per-doctor identity.
- **API**: ~45 GET/POST actions → REST with real status codes and typed errors.
- **Real-time**: WebSocket/SSE replacing the `DATA_VERSION` poll loop.
- **Integration ports**: WhatsApp Cloud API (6 manual GAS triggers → cron), Vetesoft nightly sync → Postgres cache table, Google Cloud TTS.
- **Frontend rewrite** (Next.js): `index`, `doctores`, `recepcion`, `pantalla`, `resena`, `analisis`, `guia`; `agenda-mod.js` → shared React module; `chat/` + `dashboard.html` stubs preserved at identical paths.
- **Deploy**: Docker Compose (nginx + Next.js + FastAPI + Postgres) on the Hostinger VPS, single origin.
- **Tests first**: pytest + Vitest/Playwright scaffolded before features (Strict TDD).
- **Big-bang cutover**: GAS/Sheets stay live and untouched as a short true-rollback window (hours, not days — see Rollback Plan), then remain as a read-only historical reference indefinitely.

### Out of Scope

- Replacing Vetesoft, or converting its nightly cache to per-request proxying.
- Google Calendar integration (vestigial — dropped).
- `extension-musica` Chrome extension (untouched; still depends on `pantalla/`).
- `voz-demo/`.

## Capabilities

### New Capabilities

- `staff-auth`, `queue-management`, `scheduling`, `commissions`, `notifications-whatsapp`, `vetesoft-sync`, `waiting-room-display`, `reviews`, `data-migration-etl`, `deployment-topology`

### Modified Capabilities

- None — `openspec/specs/` is empty.

## Approach

Greenfield build alongside the untouched GAS system, delivered as **stacked-to-main chained PRs**:

| # | Slice |
|---|---|
| 1 | Repo, Docker Compose, nginx, test scaffolding |
| 2 | Postgres schema + migrations |
| 3 | Historical ETL |
| 4 | Staff auth |
| 5-6 | Queue API; scheduling + commissions API |
| 7 | WebSocket/SSE layer |
| 8 | WhatsApp / Vetesoft / TTS ports + cron |
| 9-12 | Frontend per module |
| 13 | Cutover, DNS, rollback drill |

**Rejected — phased/strangler cutover**: the GAS API is a single action-router over shared Sheets state; dual-writing would multiply the concurrency risk it already has.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps-script/Code.js` | Unchanged | Stays live as rollback |
| `js/agenda-mod.js`, `doctores/`, `recepcion/`, `index.html`, `pantalla/`, `resena/`, `analisis/` | Replaced | Rewritten in Next.js |
| `chat/`, `dashboard.html` | Preserved | Meta templates deep-link here (1 edit/24h) |
| `backend/`, `frontend/`, `infra/` | New | FastAPI, Next.js, Compose/nginx |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `Anamnesis` header/`COL` drift → wrong schema | High | Re-derive from a live export before slice 2; blocks ETL |
| Row-index → PK rewrite breaks queue/agenda flows | High | Contract tests per action before rewrite |
| Turno assignment / brute-force counters lose `LockService` semantics | Med | Explicit transaction + row-lock design in `sdd-design` |
| Post-cutover Postgres writes make DNS rollback lossy past the first few hours | Med | **Decided**: accepted-loss window, no back-sync job. True rollback is only safe within that short window (see Rollback Plan); communicate the cutoff clearly to staff before go-live |
| WhatsApp triggers are undocumented and manual | Med | Inventory all 6 during slice 8; codify as cron |
| VPS undersized for Postgres + 2 apps + 43k-row index | Med | Capacity check before slice 1 |

## Rollback Plan

GAS and Sheets stay untouched throughout. Cutover is DNS-only for `servicios.animalcenter.com.co`, so reverting DNS restores the legacy system within TTL. **Decided (no back-sync job)**: any Postgres record written after go-live does not exist in Sheets, so DNS revert is only a *data-safe* rollback within a short window post-cutover (`sdd-design` to pin the exact number of hours — treat it as "same working day" by default). Past that window, GAS/Sheets remain available as a **read-only historical reference only** — reverting to it after the safe window means manually re-entering anything written since cutover, not a true rollback. This must be communicated to staff before go-live so nobody assumes day-3 revert is free. Keep Compose images tagged for per-slice container rollback regardless of the DNS-rollback window.

## Dependencies

- Live `Anamnesis` sheet export (blocks schema + ETL).
- Hostinger VPS SSH + DNS control.
- Meta WABA credentials, Vetesoft API credentials, Google Cloud TTS key.

## Open Questions

1. ~~Rollback window duration and whether back-sync is required~~ — **Resolved**: no back-sync; `sdd-design` to pin the exact safe-rollback duration (hours).
2. Do the WhatsApp number and WABA credentials transfer as-is to the new host?
3. Are VPS OS/specs confirmed adequate?
4. Postgres version, and in-Docker vs managed?

## Success Criteria

- [ ] All ~45 legacy actions have a REST equivalent with contract tests passing.
- [ ] Full Sheets history present in Postgres, row counts reconciled.
- [ ] Every staff action attributable to an authenticated user; no plaintext credentials.
- [ ] Queue/waiting-room updates arrive faster than the 2-3s polling baseline.
- [ ] `chat/`, `dashboard.html`, and `pantalla/` respond at their original paths.
- [ ] Rollback drill executed successfully before cutover.
