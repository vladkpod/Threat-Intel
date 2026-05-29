# Source & Authority Registry

Seed registry for the reconstruction/self-assessment engine. It is a maintained
artefact, not a static bibliography — versions drift, so treat this as v1 and
re-validate quarterly. Two parts: Part A feeds the Task 1 breaking-control library;
Part B feeds the Task 2 provenance graph. Tags in Part B are what make the
independence and incentive logic operational.

---

## PART A — Task 1: breaking-control / countermeasure library

Organised by the prevent / detect / respond axes plus the human-identity layer that
the technical catalogues flag `non_mappable`. Any control drawn from A2 is
`mapping_basis: analyst-asserted` in the schema, because no CTID/CIS mapping backs it.

### A1. Prevention control catalogues (the backbone, for the technical chain)
- **NIST SP 800-53 Rev 5** + **CTID ATT&CK↔800-53 mappings** (Mappings Explorer). Primary technique→control link for the post-compromise chain.
- **CIS Critical Security Controls v8.1** + **CIS Community Defense Model** (ATT&CK mapping). Questionnaire-friendly; good for client self-assessment granularity.
- **MITRE ATT&CK Mitigations (M-codes)**. Native, per-technique; union with CTID to catch what 800-53 misses.
- **MITRE D3FEND**. Defensive-technique ontology. Use to find countermeasures by mechanism — but note it is still technical-countermeasure-shaped, so it likely also under-covers help-desk verification; verify, don't assume it closes A2.
- **ISO/IEC 27001:2022 + 27002:2022**. For crosswalk to clients who report in ISO terms.
- **NCSC Cyber Assessment Framework (CAF)**. For UK CNI clients; outcome-based, maps less cleanly to ATT&CK so treat as analyst-asserted crosswalk.

### A2. Human / identity layer — the load-bearing gap-fill
These cover T1566.004 (vishing), T1656 (impersonation), T1199 (trusted relationship help-desk abuse) that A1 cannot.
- **NIST SP 800-63 (Rev 4) Digital Identity Guidelines** — 63A identity proofing, 63B authenticator binding/AAL, 63C federation. The authoritative source for "verify before reset."
- **NCSC guidance**: Passwords collection ("updating your approach"); MFA guidance; supply-chain / cloud & assured-service-provider guidance. UK-canonical.
- **NCSC + CISA post-Scattered-Spider help-desk guidance**: review reset processes; camera + government-photo-ID verification; supervisor/sponsor callback to a known number; in-person option for privileged accounts; prohibit service-desk MFA disable. (Operationalised examples exist, e.g. US national-lab service-desk reset procedures.)
- **CISA**: Identity & Access Management guidance; Phishing-Resistant MFA fact sheets; Living-off-the-Land (LOTL) guidance; RMM security advisories.
- **Vendor IdP hardening baselines** (incentive-flagged — vendor): Microsoft Entra / MSTIC Octo Tempest (Scattered Spider) hardening guidance; Okta help-desk hardening + ITDR; Google/CISA SCuBA secure-configuration baselines.
- **Privileged access / JIT**: least-standing-privilege and just-in-time vendor access patterns (PAM); CIS Safeguard 5/6.

### A3. Detection content (the survivability axis omitted in v1)
- **MITRE ATT&CK detections / data sources (DS-codes)** — per technique.
- **Sigma (SigmaHQ)** — vendor-neutral detection rules; map to chain steps.
- **Splunk Security Content (ESCU)** and **Elastic detection rules** — open, technique-tagged.
- **MITRE CAR (Cyber Analytics Repository)**.
- Focus areas for this attack class: anomalous MFA enrolment, impossible-travel/IdP anomalies, NTDS/LSASS access, RMM tool execution, ESXi/hypervisor admin activity.

### A4. Response / survivability
- **NIST SP 800-61** (Incident Handling) and **NIST CSF 2.0** (RC / Recover function).
- **NCSC Incident Management** guidance.
- **CISA #StopRansomware Guide** and ransomware-specific advisories.
- Backup/recovery integrity: CIS Control 11; immutable/offline backup of identity stores and hypervisor management.

### A5. Validation — turns a client checkbox into evidence
Used to flag each control's `testability` (validated vs self-reported).
- **Atomic Red Team** — atomic tests per ATT&CK technique.
- **MITRE ATT&CK Evaluations**, **CALDERA**, **CISA Decider**.
- Commercial BAS (incentive-flagged — vendor): AttackIQ, SafeBreach, Picus.

---

## PART B — Task 2: incident-source registry, structured for independence

Tag every source on four attributes: **class**, **proximity to ground truth**
(first-hand telemetry > insider leak > official statement > analyst inference),
**incentive bias direction**, and **primary vs derivative**. Corroboration is
counted only across sources in *different independence groups* (see B7).

### B1. CONFIRMED-tier — government / regulator (independence group G1)
- **NCSC** (UK), **CISA / FBI / IC3** (US), allied agencies (ACSC, CCCS) — advisories and incident statements.
- **ICO** (UK) — breach enforcement and monetary-penalty notices (often the only public detail on UK incidents, but lagging).
- **Cyber Monitoring Centre (CMC)** — UK independent categorisation of systemic events (categorised M&S+Co-op as a single Category 2 event).
- **Parliamentary / Congressional hearing records**; **court filings / indictments** (DOJ, NCA).
- **ENISA Threat Landscape** — EU aggregate context.
- Bias: regulators under-state pending investigation; treat as floor, not full picture.

### B2. CONFIRMED-tier — mandatory / official victim disclosure (independence group G2)
- **SEC EDGAR — 8-K Item 1.05** (US public companies; structured, fast, full-text searchable).
- **LSE RNS announcements** (UK-listed); victim press releases and annual reports.
- **US state AG breach-notification portals** (e.g. California, Maine, Washington) — structured, often earliest US confirmation.
- Bias: victims under-claim severity and frame for liability ("no payment data", "human error"); trust the *fact of* disclosure more than its characterisation.

### B3. First-hand incident response / telemetry (independence group G3)
- **Mandiant / Google Threat Intelligence (GTIG)**, **CrowdStrike**, **Microsoft Threat Intelligence (MSTIC)**, **Palo Alto Unit 42**, **Sophos X-Ops**, **Secureworks CTU**, **NCC Group**, **Darktrace**.
- Highest proximity when the firm states direct visibility. Two *different* IR firms on the same incident = genuine corroboration (separate telemetry); one firm alone = single chain.
- Bias: over-claims own product's detection efficacy. Trust raw observations; discount "we would have caught this" claims.

### B4. Specialist press — REPORTED-tier primaries (independence group G4)
- Investigative primaries: **BleepingComputer**, **The Record (Recorded Future)**, **KrebsOnSecurity**, **DataBreaches.net**, **Risky Business**.
- Majors with original reporting: **Reuters**, **Financial Times**, **Bloomberg**.
- Everything else is almost always derivative of these — collapse to the primary before counting. (The M&S NTDS.dit/ESXi specifics propagated widely from thin origins; do not let echo volume raise confidence.)

### B5. Actor-pattern intel — INFERRED-tier only, never incident-fact
- **MITRE ATT&CK Groups** (G-codes; e.g. G1015 Scattered Spider).
- **CISA/FBI joint actor advisories** (e.g. AA23-320A) and vendor actor dossiers.
- Use strictly to populate inferred/analogous tiers; tagging an M&S step from here is exactly the contamination to avoid in the breach reconstruction.

### B6. Structured feeds — for the sector/aggregate product (machine-ingestible)
- **CISA KEV catalogue**; CISA/NCSC advisory RSS.
- **Sector ISACs/ISAOs**: FS-ISAC, H-ISAC, E-ISAC, MS-ISAC, Auto-ISAC; UK **NCSC CISP**.
- **Ransomware leak-site trackers**: ransomware.live, ransomwatch (GitHub), RansomLook — for victim/claim discovery only; contents are actor-claims, not victim-fact.
- **Threat sharing**: MISP, OpenCTI, AlienVault OTX.

### B7. Independence map (how corroboration is counted)
- A claim is **independently corroborated** only when supported across ≥2 of the groups G1–G4, or by ≥2 different IR firms within G3.
- Press citing a regulator (G4→G1) is **not** independent corroboration — it's one chain. Resolve to the regulator.
- Victim disclosure (G2) confirming an IR finding (G3) **is** independent (different evidence origins).
- Leak-site (B6) "confirming" press (B4) is **not** corroboration of victim-fact.

### B8. Admissibility / exclusion policy (legal + integrity)
- **Excluded as victim-fact**: raw stolen data and criminal leak-site contents. Permitted only as INFERRED material about the actor, never as CONFIRMED about the victim. This keeps findings about a named company off a criminal dump.
- **Excluded**: SEO content farms, single-source rumour, unattributed social posts.

### B9. Temporal rules
- **Supersession**: a later, higher-tier source overrides an earlier lower-tier one; log the change and recompute confidence (M&S moved unknown → Scattered Spider → TCS help desk over weeks).
- **Decay**: a REPORTED claim that never escalates to CONFIRMED loses confidence over time rather than persisting as established fact.
