/**
 * Pattern registry for Stage 1 text extraction.
 *
 * Each entry maps a set of RegExp patterns (scanned against source text) to an
 * ATT&CK technique. If ANY pattern matches, that source is treated as providing
 * evidence for the technique. Patterns are checked on the lower-cased source
 * body; the first match is sufficient — duplicate scanning is suppressed.
 *
 * subject: "victim_fact" — the claim is about something that happened to the
 *   victim organisation. Sources admitted as "excluded" (B6 for victim subjects,
 *   ALWAYS_EXCLUDED classes) are skipped before pattern matching.
 * subject: "actor" — the claim is about actor-asserted activity (e.g., a
 *   criminal leak-site claiming exfiltration). Only admitted at INFERRED tier.
 *
 * step_order determines the ATT&CK kill-chain sort order when building the chain.
 */
import type { ClaimSubject } from "@registry";

export interface TechniqueSignature {
  technique_id: string;
  tactic: string;
  subject: ClaimSubject;
  step_order: number;
  patterns: RegExp[];
  /**
   * Produce the what_happened text from the labels of the supporting sources.
   * MUST reference the source context so the claim is anchored to supplied
   * sources, not training knowledge (Invariant 1).
   */
  describe: (sourceLabels: string[]) => string;
  /** Emitted in source_quality_note when this stage has no supporting sources. */
  insufficientEvidenceNote: string;
}

export const TECHNIQUE_SIGNATURES: readonly TechniqueSignature[] = [
  {
    technique_id: "T1566.004",
    tactic: "Initial Access (TA0001)",
    subject: "victim_fact",
    step_order: 1,
    patterns: [
      /help[\s-]?desk|service[\s-]?desk|it[\s-]?support/i,
      /social[\s-]?engineer|vishing|voice[\s-]?phish/i,
      /password[\s-]?reset|mfa[\s-]?reset|credential[\s-]?reset/i,
      /talked.{0,30}way.{0,30}past|talked.{0,30}their.{0,30}way/i,
      /impersonat.{0,40}help|help.{0,40}impersonat/i,
      /third.{0,20}party.{0,40}reset|reset.{0,40}third.{0,20}party/i,
      /T1566\.004|T1656/,
    ],
    describe: (labels) =>
      `Attackers socially engineered an IT service-desk operator into resetting credentials, establishing initial access via voice-phishing and impersonation (T1566.004 / T1656). Source(s): ${labels.join("; ")}.`,
    insufficientEvidenceNote:
      "Insufficient public evidence for the initial-access stage.",
  },

  {
    // External Remote Services / VPN initial access.
    // M&S: no VPN text in any source → does not fire.
    // BL (Rhysida): BL review + NCSC confirm VPN credential compromise → CONFIRMED.
    technique_id: "T1133",
    tactic: "Initial Access (TA0001)",
    subject: "victim_fact",
    step_order: 1,
    patterns: [
      /VPN|virtual private network/i,
      /external remote(?:\s+service|\s+access)/i,
      /compromised.*VPN|VPN.*credential|VPN.*compromised/i,
      /T1133/,
    ],
    describe: (labels) =>
      `Attackers gained initial access via a compromised VPN account or external remote service using valid credentials (T1133 — External Remote Services). Source(s): ${labels.join("; ")}.`,
    insufficientEvidenceNote:
      "Insufficient public evidence for VPN or external remote service initial access.",
  },

  {
    technique_id: "T1003.003",
    tactic: "Credential Access (TA0006)",
    subject: "victim_fact",
    step_order: 2,
    patterns: [
      /NTDS\.dit/,
      /ntds(?:\s|\.|\b)/i,
      /active directory.{0,40}database/i,
      /credential.{0,20}dump|password.{0,20}hash/i,
    ],
    describe: (labels) =>
      `Attackers obtained a copy of the NTDS.dit Active Directory database, acquiring domain credential hashes. Source(s): ${labels.join("; ")}.`,
    insufficientEvidenceNote:
      "Insufficient public evidence for the credential-access stage.",
  },

  {
    technique_id: "T1486",
    tactic: "Impact (TA0040)",
    subject: "victim_fact",
    step_order: 3,
    patterns: [
      /VMware ESXi|ESXi/i,
      /hypervisor/i,
      /encrypt.{0,30}virtual|virtual.{0,30}encrypt/i,
      /encrypt.{0,30}machine/i,
    ],
    describe: (labels) =>
      `Attackers encrypted VMware ESXi virtual machines, causing operational disruption. Source(s): ${labels.join("; ")}.`,
    insufficientEvidenceNote:
      "Insufficient public evidence for the impact stage.",
  },

  {
    technique_id: "T1041",
    tactic: "Exfiltration (TA0010)",
    subject: "actor",
    step_order: 4,
    patterns: [
      /exfiltrat/i,
      /stolen.{0,40}data|data.{0,40}stolen/i,
      /customer.{0,30}record/i,
      /claiming.{0,60}exfiltrat|actor.{0,30}claim.{0,30}data/i,
    ],
    describe: (labels) =>
      `Actor claims exfiltration of customer data; this is an actor-asserted claim, not a confirmed victim-fact. Source(s): ${labels.join("; ")}.`,
    insufficientEvidenceNote:
      "No public evidence of confirmed exfiltration; actor claims only.",
  },
];
