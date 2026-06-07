/**
 * Shared helpers for the British Library / Rhysida eval.
 *
 * The key generalisation assertions are:
 *   - T1133 (External Remote Services / VPN) fires for BL — it does NOT fire
 *     for M&S (no VPN text in M&S sources). Proves technique registry is
 *     source-driven, not incident-memorised.
 *   - T1003.003 (NTDS.dit / AD credential dump) is CONFIRMED for BL — it is
 *     REPORTED for M&S. Same technique, different tier because the British
 *     Library published its own incident review (G2 CONFIRMED), whereas the
 *     M&S NTDS.dit claim rests solely on specialist press (G4 REPORTED).
 *   - T1566.004 (help-desk social engineering) does NOT fire for BL — the BL
 *     review explicitly states the entry point was a pre-compromised contractor
 *     VPN credential, with no credential-reset or help-desk vector.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { reconstruct } from "@engine";
import type { AttackChainStep, ReconstructionOutput } from "@engine/schema";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));

export function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(`${FIXTURE_DIR}${name}`, "utf8"));
}

export function runFixture(name: string): ReconstructionOutput {
  return reconstruct(loadFixture(name));
}

export const VPN_EXTERNAL_REMOTE_RE =
  /T1133|external remote service|VPN.*credential|compromised.*VPN/i;

export const HELPDESK_RE =
  /T1566\.004|T1656|help[\s-]?desk|service[\s-]?desk|vishing|social.engineer/i;

export const NTDS_RE = /T1003\.003|NTDS\.dit|ntds|active directory.*database/i;

export function findStep(
  output: ReconstructionOutput,
  re: RegExp,
): AttackChainStep | undefined {
  return output.attack_chain.find(
    (s) => re.test(s.attack_technique ?? "") || re.test(s.what_happened),
  );
}

export function filterSteps(
  output: ReconstructionOutput,
  re: RegExp,
): AttackChainStep[] {
  return output.attack_chain.filter(
    (s) => re.test(s.attack_technique ?? "") || re.test(s.what_happened),
  );
}
