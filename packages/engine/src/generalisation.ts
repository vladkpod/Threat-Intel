/**
 * Stage 2: Generalisation — strips victim-specific detail from the attack chain
 * and emits a reusable attack pattern plus inferred control gaps.
 *
 * Gap text is always phrased as an inference from the observed chain, never as
 * a stated failing of the victim organisation (Invariant 10).
 */
import type {
  AttackChainStep,
  GeneralisedPattern,
  InferableControlGap,
} from "./schema.js";

const TECHNIQUE_PRECONDITIONS: Record<string, string> = {
  "T1566.004":
    "An IT service desk or outsourced support function is accessible for credential and MFA resets; the reset process relies on caller-supplied identity without secondary verification.",
  "T1656":
    "Social-engineering channels exist through which an attacker can impersonate a legitimate user to obtain privileged access.",
  "T1003.003":
    "A domain administrator or equivalent credential has been established; NTDS.dit or equivalent AD credential databases are reachable.",
  "T1486":
    "Domain credentials with access to virtualisation infrastructure have been obtained; ESXi or equivalent hypervisors are reachable from a compromised host.",
  "T1041":
    "Exfiltration channels are available from the compromised environment; this is an actor-asserted claim rather than a confirmed victim-fact.",
};

const TECHNIQUE_GAP_TEMPLATES: Record<string, string> = {
  "T1566.004":
    "Inferable from the observed chain that service-desk credential-reset processes lacked robust caller-identity verification at the point of initial access (consistent with T1566.004 / T1656 proceeding without detection or prevention).",
  "T1656":
    "Inferable from the observed chain that impersonation of legitimate users via social-engineering channels was not prevented or detected before a credential reset was completed (consistent with T1656).",
  "T1003.003":
    "Inferable from the observed chain that domain credential databases were accessible following the initial-access foothold, with insufficient controls to prevent or alert on credential-dumping activity (consistent with T1003.003 proceeding).",
  "T1486":
    "Inferable from the observed chain that virtualisation infrastructure was accessible from compromised domain credentials without sufficient segmentation, allowing ransomware deployment (consistent with T1486 impact proceeding).",
  "T1041":
    "Inferred from actor-asserted claims: exfiltration paths may have been accessible from the compromised environment; this is an actor claim and is consistent with, but not confirmed by, victim-fact sources.",
};

function techniqueLabel(technique: string, tactic: string): string {
  return `${technique} (${tactic.replace(/ \(TA\d+\)/, "")})`;
}

export function generalise(steps: AttackChainStep[]): {
  pattern: GeneralisedPattern;
  gaps: InferableControlGap[];
} {
  if (steps.length === 0) {
    return {
      pattern: {
        title: "No attack pattern — insufficient source evidence.",
        preconditions: [],
        chain_summary:
          "No attack steps could be reconstructed from the supplied sources; no generic pattern can be derived.",
      },
      gaps: [],
    };
  }

  const firstStep = steps[0]!;
  const lastStep = steps[steps.length - 1]!;

  const preconditions = steps
    .map(
      (s) =>
        TECHNIQUE_PRECONDITIONS[s.attack_technique] ??
        `Access conditions for ${s.attack_technique} are met.`,
    )
    .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  const chainSummary =
    `A ${steps.length}-stage attack chain progressing from ` +
    `${techniqueLabel(firstStep.attack_technique, firstStep.attack_tactic)} ` +
    (steps.length > 1
      ? `through intermediate stages to ` +
        `${techniqueLabel(lastStep.attack_technique, lastStep.attack_tactic)}.`
      : "(single-stage).") +
    ` The pattern is applicable to any organisation matching the preconditions above; ` +
    `victim-specific detail has been removed to produce a reusable template.`;

  const pattern: GeneralisedPattern = {
    title: `${steps.length}-stage intrusion: ${techniqueLabel(firstStep.attack_technique, firstStep.attack_tactic)} → ${techniqueLabel(lastStep.attack_technique, lastStep.attack_tactic)}`,
    preconditions,
    chain_summary: chainSummary,
  };

  const gaps: InferableControlGap[] = steps.map((s) => ({
    gap:
      TECHNIQUE_GAP_TEMPLATES[s.attack_technique] ??
      `Inferred from the observed chain that controls for ${s.attack_technique} were insufficient to prevent or detect this step (consistent with the attack proceeding).`,
    supports_step: [s.step],
    evidence_tier: s.evidence_tier,
  }));

  return { pattern, gaps };
}
