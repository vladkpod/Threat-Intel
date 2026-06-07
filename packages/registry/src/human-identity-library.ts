/**
 * Analyst-asserted breaking controls for human-identity techniques where CTID
 * 800-53 mappings are non_mappable or absent (Invariant 4).
 *
 * T1566.004 (Spearphishing Voice / vishing) is explicitly flagged non_mappable
 * in the CTID NIST 800-53 rev5 dataset. T1656 (Impersonation) has no complete
 * mapping. Neither can be served by CTID, so controls come from this
 * hand-authored library with mapping_basis: "analyst-asserted".
 *
 * Sources for control content: NIST SP 800-63B §6.1.2 (identity proofing),
 * NCSC MFA guidance (help-desk reset hardening), CISA Advisory AA23-320A
 * (Scattered Spider TTPs, service-desk monitoring).
 */

/** Defensive axes — must stay in sync with schema.ts DefensiveAxis. */
export type ControlAxis = "prevent" | "detect" | "respond";

/** Testability — must stay in sync with schema.ts Testability. */
export type ControlTestability =
  | "BAS-validatable"
  | "red-team-validatable"
  | "self-reported-only";

export interface HumanIdentityControl {
  technique_id: string;
  axis: ControlAxis;
  description: string;
  framework_ref: string;
  testability: ControlTestability;
}

export const HUMAN_IDENTITY_CONTROLS: readonly HumanIdentityControl[] = [
  // ── T1566.004 — Spearphishing Voice (help-desk vishing) ───────────────────
  {
    technique_id: "T1566.004",
    axis: "prevent",
    description:
      "Require call-back verification to a number drawn from authoritative identity records before any credential or MFA reset; prohibit resets based solely on caller-supplied information.",
    framework_ref: "NCSC MFA guidance — help-desk reset hardening (analyst-asserted)",
    testability: "red-team-validatable",
  },
  {
    technique_id: "T1566.004",
    axis: "prevent",
    description:
      "Apply NIST SP 800-63B §6.1.2 re-enrolment requirements for privileged account resets: secondary identity evidence or in-person verification before any credential replacement.",
    framework_ref: "NIST SP 800-63B §6.1.2",
    testability: "self-reported-only",
  },
  {
    technique_id: "T1566.004",
    axis: "detect",
    description:
      "Alert on bulk, out-of-hours, or otherwise anomalous MFA enrolment or credential-reset events originating from the IT service desk; correlate against HR-verified user activity.",
    framework_ref: "CISA Advisory AA23-320A — MFA enrolment monitoring (analyst-asserted)",
    testability: "BAS-validatable",
  },
  {
    technique_id: "T1566.004",
    axis: "respond",
    description:
      "Suspend the affected account and revoke all active sessions upon detection of a suspected fraudulent service-desk reset; require secondary authentication before re-enrolment.",
    framework_ref: "NCSC Incident Response guidance — credential reset response (analyst-asserted)",
    testability: "self-reported-only",
  },

  // ── T1656 — Impersonation ─────────────────────────────────────────────────
  {
    technique_id: "T1656",
    axis: "prevent",
    description:
      "Mandate identity verification against authoritative HR records for any request involving an executive impersonator or urgently-framed credential action; apply the same NIST 800-63B §6.1.2 bar as for voice-channel resets.",
    framework_ref: "NIST SP 800-63B §6.1.2 — identity proofing for account recovery (analyst-asserted)",
    testability: "self-reported-only",
  },
  {
    technique_id: "T1656",
    axis: "detect",
    description:
      "Monitor service-desk interaction patterns for impersonation indicators: multiple resets for the same account, resets for senior personnel, and resets immediately preceded by social calls.",
    framework_ref:
      "CISA Advisory AA23-320A — behavioural monitoring of service-desk channels (analyst-asserted)",
    testability: "BAS-validatable",
  },
  {
    technique_id: "T1656",
    axis: "respond",
    description:
      "Revoke all sessions for any account that received an unverified reset; escalate to incident response if lateral movement is detected within the same session.",
    framework_ref: "NCSC Incident Response guidance — post-reset impersonation response (analyst-asserted)",
    testability: "self-reported-only",
  },
];

/** Controls for a specific technique; returns empty array if none defined. */
export function humanIdentityControlsFor(
  techniqueId: string,
): HumanIdentityControl[] {
  return HUMAN_IDENTITY_CONTROLS.filter((c) => c.technique_id === techniqueId);
}
