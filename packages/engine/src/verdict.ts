/**
 * Stage 3b: Verdict computation.
 *
 * Determines the earliest step where the client's stated controls achieve a
 * break across ANY of the prevent / detect / respond axes — not prevention
 * only (Invariant 3). Confidence is capped at the weakest evidence tier on the
 * critical path (steps up to and including the earliest breakable step, or the
 * full chain if no break) — Invariant 9.
 *
 * Control matching uses keyword overlap between the client's controls_present
 * strings and the breaking control descriptions. The threshold is intentionally
 * conservative (≥2 shared meaningful tokens) to avoid false assurance.
 */
import { TIER_RANK, type EvidenceTier } from "@registry";
import type {
  AttackChainStep,
  ClientProfile,
  DefensiveAxis,
  SelfAssessmentEntry,
  Verdict,
  VerdictResult,
} from "./schema.js";

// Tokens to ignore when computing keyword overlap.
const STOP_WORDS = new Set([
  "the", "a", "an", "of", "on", "in", "for", "to", "or", "and", "is",
  "at", "it", "any", "from", "by", "as", "be", "this", "that", "not",
  "all", "one", "up", "no", "with", "are", "its", "your", "which",
  "when", "has", "have", "does", "your", "their", "can", "via", "per",
  "such", "each", "both",
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[()[\]/\\]/g, " ")
    .split(/[\s,;:–—]+/)
    .map((t) => t.replace(/[^a-z0-9.-]/g, ""))
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Return true if the client's stated control is semantically relevant to the
 * given breaking control. Requires axis alignment AND ≥2 shared meaningful tokens.
 */
function clientControlMatches(
  clientControlText: string,
  breakingCtrlDescription: string,
  breakingCtrlAxis: DefensiveAxis,
): boolean {
  const clientTokens = new Set(tokenise(clientControlText));

  // Axis detection from client control text.
  const axisSignals: Record<DefensiveAxis, string[]> = {
    prevent: ["prevent", "block", "restrict", "require", "enforce", "harden",
               "disable", "prohibit", "denied", "policy", "verification", "verify"],
    detect: ["detect", "detection", "alert", "alerting", "monitor", "monitoring",
              "anomaly", "anomalous", "soc", "siem", "log", "logging", "ids"],
    respond: ["respond", "response", "incident", "revoke", "suspend", "isolate",
               "recover", "restore", "playbook", "contain", "eradicate"],
  };

  const detectedAxes = new Set<DefensiveAxis>();
  for (const [axis, signals] of Object.entries(axisSignals) as [DefensiveAxis, string[]][]) {
    if (signals.some((s) => clientTokens.has(s) || [...clientTokens].some((t) => t.includes(s)))) {
      detectedAxes.add(axis);
    }
  }

  // If the client control's detected axis doesn't match the breaking control's
  // axis, skip — we don't want a detect control satisfying a prevent requirement.
  if (!detectedAxes.has(breakingCtrlAxis)) return false;

  // Token overlap between client control and breaking control description.
  const ctrlTokens = tokenise(breakingCtrlDescription);
  const overlap = ctrlTokens.filter((t) => clientTokens.has(t));
  return overlap.length >= 2;
}

function weakestTier(tiers: EvidenceTier[]): EvidenceTier {
  if (tiers.length === 0) return "INFERRED";
  return tiers.reduce((w, t) => (TIER_RANK[t] < TIER_RANK[w] ? t : w));
}

export function computeVerdict(
  steps: AttackChainStep[],
  clientProfile: ClientProfile | null,
  selfAssessment: SelfAssessmentEntry[],
): Verdict {
  const clientControls = clientProfile?.controls_present ?? [];

  let earliestBreakableStep: number | null = null;
  let breakAxis: DefensiveAxis | null = null;

  outer: for (const step of steps) {
    for (const ctrl of step.breaking_controls) {
      for (const clientCtrl of clientControls) {
        if (clientControlMatches(clientCtrl, ctrl.description, ctrl.axis)) {
          earliestBreakableStep = step.step;
          breakAxis = ctrl.axis;
          break outer;
        }
      }
    }
  }

  // Critical path: all steps up to and including the earliest breakable step
  // (or the full chain if no break found).
  const criticalPathEnd = earliestBreakableStep ?? steps.length;
  const criticalPath = steps.filter((s) => s.step <= criticalPathEnd);
  const confidence = weakestTier(criticalPath.map((s) => s.evidence_tier));

  // Determine result.
  let result: VerdictResult;
  if (earliestBreakableStep === null || clientControls.length === 0) {
    result = "indeterminate";
  } else if (breakAxis === "prevent") {
    result = "would_likely_fail";
  } else {
    // detect or respond — break is plausible but not guaranteed.
    result = "indeterminate";
  }

  // Caveats.
  const caveats: string[] = [];
  if (selfAssessment.some((e) => e.testability === "self-reported-only")) {
    caveats.push(
      "One or more controls relied upon in this assessment are self-reported by the client and have not been independently validated; the verdict reflects self-reported control state and may overstate defensive coverage.",
    );
  }
  if (confidence === "INFERRED" || confidence === "ANALOGOUS") {
    caveats.push(
      "The weakest evidence tier on the critical path is INFERRED or ANALOGOUS; this verdict is contingent on unconfirmed reporting.",
    );
  }
  if (clientControls.length === 0) {
    caveats.push(
      "No client control profile was supplied; a generic 'indeterminate' result is returned. Provide controls_present to obtain a client-specific verdict.",
    );
  }

  const method =
    "Breakability is assessed across prevent, detect, and respond axes for each attack chain step. " +
    "The earliest step at which the client's stated controls achieve a break (on any axis) determines " +
    "the earliest_breakable_step and break_axis. Verdict confidence is capped at the weakest evidence " +
    "tier among all steps on the critical path (Invariant 9). A break via detect or respond may still " +
    "permit the attack to partially succeed before intervention; a break via prevent denies the step " +
    "entirely. Self-reported controls are noted in caveats.";

  return {
    method,
    result,
    earliest_breakable_step: earliestBreakableStep,
    break_axis: breakAxis,
    confidence,
    caveats,
  };
}
