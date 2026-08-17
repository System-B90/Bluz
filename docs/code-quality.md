# Code Quality Review — SOLID & DRY

Assessment of the codebase against SOLID and DRY, current as of the performance
refactor. Use it as a map of what is healthy, what is debt, and where to work next.

## SOLID

### Single Responsibility — mostly healthy

- The four-layer split (`api-client` → `app/api` → `api-server` → `api-shared`)
  gives every file one reason to change, and the per-directory READMEs enforce it.
- Each `db-*.ts` controller owns exactly one collection/table.
- **Debt**: `mongo-db-controller.ts` still carries three responsibilities — client
  configuration, the controller cache, and current-iteration resolution. Splitting
  iteration resolution into its own module is the next worthwhile cut.

### Open/Closed — healthy at the route layer

- `buildGantCollectionRoutes` / `buildGantItemRoutes` + `drizzleOperationsBuilder`
  mean a new Gantt entity is added by *composition* (wire a table into the
  builders), not by editing shared handler code.
- `withApi` (in `api-server/common.ts`) extends error handling without touching
  handlers.

### Liskov Substitution — one known violation

- Everything implementing `BasicGantOperations` is interchangeable to the route
  builders, **except** `createNewItem`, which may return `ApiT<TEntity>` *or*
  `TEntity` (see the `TODO` in `app/api/gantt/base-collection.ts`). Callers must
  not assume one shape. Normalizing to `ApiT<TEntity>` everywhere removes the trap.

### Interface Segregation — acceptable

- `BasicGantOperations` forces every entity to implement all six operations even
  when a route only mounts two of them. Tolerable at current entity count; split
  into read/write halves if an entity ever cannot support an operation.

### Dependency Inversion — healthy

- Route builders depend on the `BasicGantOperations` abstraction, not on Drizzle.
- Mongo controllers accept a `DatabaseController` parameter (defaulted), which is
  what makes the backend unit-testable without a live database.
- **Debt**: `db-*.ts` modules default-import the concrete `databaseController`
  singleton. Fine for now — the parameter is the injection seam.

## DRY

### Healthy

- Gantt CRUD: one operations factory + two route builders cover ~10 entities.
- `withApi` removed the copy-pasted `try { … } catch { catchHandler }` boilerplate
  from the route builders and calendar routes.
- `ApiSuccess` / `ApiErrorMaker` / `catchHandler` centralize the response envelope.

### Remaining duplication (ranked)

1. Hand-written routes outside the builders still open with the same try/catch
   block — migrate them to `withApi` as they are touched (do not mass-edit).
2. `resolveIterationFromRequest` + body-shape validation repeats across calendar
   routes; a small zod-style validator (or shared guard helpers) would collapse it.
3. `session-server/session-common.ts` duplicates constants from `ui/src/settings.tsx`
   (`MessageTypes`, magic sender values). They must be kept in sync by hand today;
   extracting a tiny shared package is the clean fix.

## Working agreements

- New route handlers: wrap with `withApi`, throw `ClientApiError` for 400s.
- New Gantt entities: use the builders; never hand-write CRUD.
- New Mongo query paths: add the matching index to `ensureIndexesInBackground`.
- Keep `api-shared` side-effect-free; keep browser imports out of `api-server`.
