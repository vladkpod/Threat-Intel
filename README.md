# Threat-Intel

Threat-intelligence reconstruction & self-assessment platform. Two products on a
shared dashboard:

- **Product A — incident engine**: reconstructs a named cyber incident into an
  evidence-tiered, MITRE ATT&CK-mapped attack chain, then generates a "would this
  have worked on us" control self-assessment for a different organisation.
- **Product B — sector view**: aggregates incidents/feeds into per-sector trend
  intelligence.

See [`CLAUDE.md`](./CLAUDE.md) for how to build, the non-negotiable invariants,
and the Definition of done. Behaviour is governed by
[`docs/incident_reconstruction_prompt.md`](./docs/incident_reconstruction_prompt.md)
and [`docs/source_authority_registry.md`](./docs/source_authority_registry.md).

## Status

**M0 — eval contract + schema.** The M&S golden eval
([`tests/eval/ms_2025/`](./tests/eval/ms_2025/)) is the contract the rest of the
build is judged against. It is committed and runnable now; every assertion fails
by design because the engine is an M0 stub. The engine stages land in M1–M3, and
the full eval going green is the M3 gate (= Definition of done).

## Layout

```
docs/                       behaviour + source-of-truth specs
packages/engine/            Product A — three-stage reconstruction engine
  src/schema.ts             output contract (Zod) referenced by the eval
  src/index.ts              entry point (M0 stub)
tests/eval/ms_2025/         the M&S golden eval — fixtures + assertions
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile the workspace |
| `npm test` | Unit tests |
| `npm run eval` | M&S golden eval (the contract) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (enforces no default exports) |
