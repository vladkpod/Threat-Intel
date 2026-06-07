# M&S Golden Eval (`ms_2025`)

This directory is **the contract** for Product A (the incident engine). Per
`CLAUDE.md`, the build is not "done" until `npm run eval` is green against these
assertions. The engine is judged against this eval — not the other way round.

## Layout

- `fixtures/` — synthetic-but-realistic source sets modelling the public record
  of the M&S April–May 2025 incident. Each source carries the provenance
  metadata the engine needs for tiering, independence, and admissibility logic.
- `assertions/` — one `*.eval.ts` per test case. Assertion IDs (`[A{tc}.{n}]`)
  map to the signed-off eval spec and to the `CLAUDE.md` invariants.
- `helpers.ts` — fixture loading + tier helpers shared across test cases.
- `fixtures/GROUND_TRUTH.md` — the public-record sourcing for every realistic
  fixture claim, and the flag that the provenance-variant fixtures are
  synthetic counterfactual probes, not real claims.

## Test cases → coverage

| File | Fixture(s) | DoD item | Invariants |
|------|-----------|----------|------------|
| `ms_full_reconstruction.eval.ts` | `sources_full.json` | #1–#4 | 2, 3, 4, 6, 9, 10 |
| `ms_thin_source.eval.ts` | `sources_thin.json` | #5 | 1 |
| `ms_echo_corroboration.eval.ts` | `sources_echo.json` | #6 | 5 |
| `ms_admissibility.eval.ts` | `sources_with_leaksite.json` | — | 7 |
| `ms_temporal_supersession.eval.ts` | `sources_temporal_v1/v2.json` | — | 8 |
| `ms_provenance_variant.eval.ts` | `provenance_variant_a/b.json` | — | 1, 2 |

All ten `CLAUDE.md` invariants are exercised; all six Definition-of-done bullets
are covered. `ms_provenance_variant` is the anti-false-assurance probe: the same
two claims appear in both fixtures with swapped provenance, so the tiers must
swap — an engine that has merely memorised the M&S answer passes one variant and
fails the other.

## Current status (M0)

The engine (`@engine`) is an M0 stub: `reconstruct()` validates input against the
schema, then throws `NotImplementedError`. So **every assertion fails by design**
right now. Stages land in M1–M3; the full eval going green is the M3 gate.

Run with:

```
npm run eval
```
