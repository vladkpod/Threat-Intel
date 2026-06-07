/**
 * Shared helpers for the M&S golden eval.
 *
 * The assertions are the contract (see the eval spec). They are written against
 * the engine's structured output as defined in @engine/schema. Until the engine
 * is implemented (M1-M3), `runFixture` throws and every assertion fails — the
 * intended M0 state.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { reconstruct } from "@engine";
import {
  TIER_RANK,
  type AttackChainStep,
  type EvidenceTier,
  type ReconstructionOutput,
} from "@engine/schema";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));

export function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(`${FIXTURE_DIR}${name}`, "utf8"));
}

/** Run the engine against a named fixture file. Throws until the engine lands. */
export function runFixture(name: string): ReconstructionOutput {
  return reconstruct(loadFixture(name));
}

const TIER_VALUES = Object.keys(TIER_RANK) as EvidenceTier[];

/** Weakest (lowest-ranked) tier across a set of tiers. */
export function weakestTier(tiers: EvidenceTier[]): EvidenceTier {
  return tiers.reduce((weakest, t) =>
    TIER_RANK[t] < TIER_RANK[weakest] ? t : weakest,
  );
}

export function tierAtMost(tier: EvidenceTier, ceiling: EvidenceTier): boolean {
  return TIER_RANK[tier] <= TIER_RANK[ceiling];
}

export const HELPDESK_RE = /T1566\.004|T1656|T1199|help.?desk|service.?desk|social.engineering/i;
export const NTDS_RE = /NTDS\.dit|ntds/i;
export const ESXI_RE = /ESXi|hypervisor|encrypt/i;
export const VISHING_IMPERSONATION_RE = /T1566\.004|T1656/i;

export function findStep(
  output: ReconstructionOutput,
  re: RegExp,
): AttackChainStep | undefined {
  return output.attack_chain.find(
    (s) => re.test(s.attack_technique) || re.test(s.what_happened),
  );
}

export function filterSteps(
  output: ReconstructionOutput,
  re: RegExp,
): AttackChainStep[] {
  return output.attack_chain.filter(
    (s) => re.test(s.attack_technique) || re.test(s.what_happened),
  );
}

/** All TIER_VALUES, weakest first — handy for exhaustiveness checks. */
export const TIERS_WEAKEST_FIRST = [...TIER_VALUES].sort(
  (a, b) => TIER_RANK[a] - TIER_RANK[b],
);
