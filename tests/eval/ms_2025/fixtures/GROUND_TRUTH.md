# M&S 2025 fixtures — ground-truth sourcing

The golden eval is only a valid contract if its "golden" answers are real. This
file records the public-record basis for every claim encoded in the realistic
fixtures, and flags the synthetic probe fixtures as **not** real claims. It was
produced by verifying each fact against primary or named sources (web-retrieved),
and it is the reference for what each fixture is allowed to assert.

Tier vocabulary mirrors registry §B: **G1** government/regulator/independent
authority, **G2** mandatory victim disclosure, **G3** first-hand IR firm, **G4**
specialist press primary, **B5** actor-pattern intel.

## Realistic fixtures (`sources_full`, `sources_with_leaksite`, `sources_temporal_*`)

| Fixture source | Real-world basis | Strongest real tier | Confirmed vs reported | Reference |
|---|---|---|---|---|
| `MS-001` CMC | Cyber Monitoring Centre statement, 20 Jun 2025: M&S + Co-op assessed as a single **Category 2** systemic event, est. £270m–£440m. | **G1** | CONFIRMED (categorisation/impact only — CMC does **not** state the vector) | [cybermonitoringcentre.com](https://cybermonitoringcentre.com/2025/06/20/cyber-monitoring-centre-statement-on-ransomware-incidents-in-the-retail-sector-june-2025/) |
| `MS-002` RNS | M&S LSE RNS 22 Apr 2025 ("Cyber Incident Update") + 25 Apr 2025 ("Further Update"): incident confirmed, NCSC notified, online orders paused. | **G2** | CONFIRMED (incident + order pause; **no** technical vector, **no** attribution) | [22 Apr RNS](https://www.investegate.co.uk/announcement/rns/marks-spencer-group--mks/cyber-incident-update/8840171) · [25 Apr RNS](https://www.investegate.co.uk/announcement/rns/marks-spencer-group--mks/cyber-incident-further-update-/8847455) |
| `MS-005` Parliament | Archie Norman (M&S Chairman) oral evidence to the Commons Business & Trade Committee, 8 Jul 2025: confirmed sophisticated impersonation; a **third party** handling IT support was induced to reset an internal user's password. Did **not** name the third party; said the company had not itself confirmed a named group. | **G1** (parliamentary record, §B1) | **CONFIRMED** — this, not the RNS, is what confirms the help-desk vector | [Irish Examiner](https://www.irishexaminer.com/business/companies/arid-41665775.html) · [Insurance Journal](https://www.insurancejournal.com/news/international/2025/07/10/831058.htm) |
| `MS-003` BleepingComputer | NTDS.dit theft, VMware ESXi encryption, Scattered Spider / DragonForce link — sourced to unnamed "sources familiar with the matter". | **G4** (single chain) | **REPORTED only** — never officially confirmed by M&S, a regulator, or an IR firm with stated first-hand telemetry | [bleepingcomputer.com](https://www.bleepingcomputer.com/news/security/marks-and-spencer-breach-linked-to-scattered-spider-ransomware-attack/) |
| `MS-004` AA23-320A | CISA/FBI Scattered Spider actor advisory — vishing help desks, impersonation, NTDS.dit, ESXi targeting as documented TTPs. | **B5** | INFERRED/actor-pattern only — never incident-fact | [cisa.gov AA23-320a](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-320a) |
| `THIN-001` (thin/temporal v1) | Generic early news wire; helpdesk vector floated but "not officially confirmed". Models the April state of knowledge. | **G4** | REPORTED at best — intentionally insufficient | (composite of early Apr 2025 coverage) |
| `LEAK-001` | A ransomware leak-site post claiming responsibility and asserting customer-data exfiltration, with a purported sample. | **B6** | **Excluded as victim-fact** (registry §B8); admissible only as INFERRED-about-actor | (leak-site contents — not linked by policy) |

### Key confirmed-vs-reported split the fixtures must preserve
- **Officially confirmed (G1/G2):** the incident itself, NCSC notification, online-order pause (RNS); the help-desk social-engineering vector (parliamentary testimony, 8 Jul 2025); the CMC Category 2 single-event classification.
- **Reported only (G4 / unnamed sources):** NTDS.dit theft; ESXi encryption and its 24 Apr date; the naming of TCS as the help desk; the Scattered Spider attribution. M&S, the NCA, and the NCSC did not officially confirm the group.

This is the exact distinction the eval enforces: `MS-005` carries the help-desk
step to CONFIRMED; `MS-003` holds NTDS.dit/ESXi at REPORTED; `MS-004` must never
lift either to CONFIRMED.

## Synthetic probe fixtures (`provenance_variant_a`, `provenance_variant_b`) — NOT real claims

These two fixtures are **counterfactual by construction**. They reuse the M&S
claims but attach deliberately inverted provenance to test that the engine tiers
from supplied provenance rather than from memory of the incident. Specifically:

- `provenance_variant_a` attaches a **fictional regulator advisory** to the
  NTDS.dit claim (so it should tier CONFIRMED **in this fixture only**) and
  press-only provenance to the help-desk claim (REPORTED). **No regulator ever
  confirmed NTDS.dit in reality** — see `MS-003` above.
- `provenance_variant_b` is the inverse: help-desk authoritative (CONFIRMED),
  NTDS.dit press-only (REPORTED), which matches reality.

Because the tiers must swap between A and B, an engine that hard-codes the real
answer fails one variant. Do not cite variant A as evidence of anything about the
real incident; it exists solely as a provenance-tracking test.
