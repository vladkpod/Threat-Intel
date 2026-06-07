# CLAUDE.md — Threat Intelligence Reconstruction & Self-Assessment Platform

## What this is
A platform with two products on a shared dashboard:
- **Product A — incident engine**: reconstructs a named cyber incident into an evidence-tiered, MITRE ATT&CK-mapped attack chain, then generates a "would this have worked on us" control self-assessment for a different organisation.
- **Product B — sector view**: aggregates many incidents/feeds into per-sector trend intelligence.

Read these before doing anything: `docs/incident_reconstruction_prompt.md` (the runtime engine system prompt) and `docs/source_authority_registry.md` (the source + control registry). They are the source of truth for behaviour; this file is the source of truth for how to build.

## Architecture (do not collapse these)
Product A is a **three-stage chain**, not one call:
1. **Extraction** — sources → structured ATT&CK-tagged chain object, one evidence tier + provenance per step. Verifiable/cacheable before anything downstream.
2. **Generalisation** — strip victim specifics → reusable attack pattern + the breaking control at each step.
3. **Self-assessment** — pattern → client questionnaire mapped to controls + a verdict.
The runtime LLM is a synthesis layer over retrieved sources. It is **never** the source of facts.

## NON-NEGOTIABLE INVARIANTS (these are tested; a build that violates one is not "done")
1. **No parametric TTPs.** Every incident claim must trace to a supplied source. No source for a step → the step does not exist. The engine must be able to say "insufficient public evidence for [stage]".
2. **Evidence tiering is mandatory, per claim** (CONFIRMED / REPORTED / INFERRED / ANALOGOUS), with provenance. Tiering attaches to the *claim*, not the document.
3. **Breakability, not control count.** Coverage of a step = does ≥1 countermeasure exist that breaks it, across **prevent / detect / respond** axes — not how many controls map. Never surface a numeric "coverage score" derived from control cardinality.
4. **Union of defensive sources.** Draw breaking controls from CTID 800-53/CIS **plus** ATT&CK Mitigations **plus** D3FEND **plus** detection content **plus** the hand-authored human-identity library. Controls from the human-identity library carry `mapping_basis: analyst-asserted`.
5. **Corroboration counts only across independent sources.** Press citing a regulator is one chain, not two. Same for a leak-site echoing a news report. See registry §B7. The corroboration counter must not increment within one independence group.
6. **Self-report ≠ evidence.** A client ticking "control present" is the weakest tier. Every control carries a `testability` flag (BAS/red-team validatable vs self-reported); the verdict must surface its reliance on self-report.
7. **Admissibility.** Raw stolen data and criminal leak-site contents are never admitted as victim-fact — INFERRED-about-actor only. See registry §B8.
8. **Temporal honesty.** Incidents are versioned. Later higher-tier sources supersede earlier lower-tier (logged, confidence recomputed). Unconfirmed REPORTED claims decay in confidence over time.
9. **No false confidence.** Verdict confidence is capped at the weakest evidence tier on the critical path. "indeterminate pending confirmation" is a valid, expected output.
10. **No attribution of named-company failings as fact.** Phrase as "control gaps inferable from the observed chain," tier-weighted. Defamation and epistemics both require this.

## Definition of done
The **M&S golden eval** (`tests/eval/ms_2025/`) passes:
- help-desk social-engineering vector tiered CONFIRMED; NTDS.dit/ESXi specifics tiered REPORTED, NOT CONFIRMED.
- T1566.004 / T1656 self-assessment steps draw breaking controls from the human-identity library (analyst-asserted), not from CTID (which flags them non_mappable).
- the verdict's "earliest breakable step" is computed across prevent/detect/respond, not prevention only.
- feeding a thin-source fixture yields "insufficient evidence", not a fabricated chain.
- corroboration on a one-primary-many-echoes fixture does not exceed 1.

## Stack
Propose in plan mode and get sign-off before scaffolding. Defaults unless there's reason: TypeScript (strict, no default exports), a typed API layer, Postgres for the incident/source store (claims are relational and versioned), a job/queue for ingestion, React + the project's design system for the dashboard. Pin the ATT&CK and CTID mapping versions; treat them as versioned data dependencies, not vendored snapshots.

## Commands
- Build: `npm run build`
- Test: `npm test`  (eval suite: `npm run eval`)
- Typecheck: `npm run typecheck`
- Lint/format: `npm run lint -- --fix`
Run typecheck + lint after every change set. Do not bypass hooks.

## What NOT to do
- Do not let the LLM generate incident facts from its own knowledge.
- Do not build a single mega-prompt; keep the three stages separable and independently testable.
- Do not emit a control-count coverage metric.
- Do not store browser localStorage/sessionStorage in any artifact-style frontend.
- Do not invent source attributions; if a claim lacks a tier+provenance, drop it.
- Do not mark the build complete with the M&S eval failing or skipped.

## M6 — Auto-update pipeline additions

### Queue technology
Postgres-native job queue only (pg-boss preferred). Do not introduce Redis or BullMQ.
The existing Postgres store is the right substrate; no new infrastructure.

### Invariant 11 — human review gate (non-negotiable)
Auto-detected incidents route to a human review queue before any reconstruction
is initiated. Verdict-change notifications route to human review before reaching
clients. There is no code path that auto-reconstructs or auto-notifies without
human approval. A test that auto-reconstruction fires without approval is a
failing test, not an acceptable shortcut.

### Invariant 12 — tier ceiling enforcement
Auto-ingested claims inherit the tier ceiling of their source class (press RSS =
REPORTED ceiling; regulator advisory = CONFIRMED ceiling). No auto-ingestion
path may store a claim at a higher tier than its source class permits.

### M6 decay rule
Decay is a caveat flag on read, not a score mutation. A REPORTED-tier open claim
older than the staleness threshold gets a caveats[] entry; its stored confidence
is unchanged. Do not confuse with supersession (TC-5, already done).

## Known limitations
Extraction pattern matching is negation-blind — phrases like "no evidence of X" will register as positive technique detections; negation-aware extraction is scoped to M7.
