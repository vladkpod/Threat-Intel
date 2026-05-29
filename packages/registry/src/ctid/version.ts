/**
 * Pinned CTID ATT&CK↔NIST 800-53 mapping version.
 *
 * Per CLAUDE.md the mapping is a *versioned data dependency*: we pin a specific
 * commit + ATT&CK/800-53 revision and resolve the file from the official source,
 * rather than vendoring a drifting snapshot. The format and pin below were
 * verified by inspecting the real dataset (Mappings Explorer, JSON Unified
 * Schema). License: Apache-2.0.
 */
export interface CtidPin {
  project: string;
  release_tag: string;
  commit: string;
  release_date: string;
  attack_version: string;
  framework: "nist_800_53";
  framework_revision: "rev4" | "rev5";
  license: string;
  /** Resolve the raw download URL for the pinned mapping file. */
  rawUrl: () => string;
}

export const CTID_PIN: CtidPin = {
  project: "center-for-threat-informed-defense/mappings-explorer",
  release_tag: "mappings_explorer-v1.1.0",
  commit: "d4c41dd717a2785664313ee1ad69be3871899d3f",
  release_date: "2024-04-15",
  attack_version: "16.1",
  framework: "nist_800_53",
  framework_revision: "rev5",
  license: "Apache-2.0",
  rawUrl(): string {
    const { commit, attack_version, framework_revision } = this;
    return (
      `https://raw.githubusercontent.com/center-for-threat-informed-defense/mappings-explorer/${commit}` +
      `/mappings/nist_800_53/attack-${attack_version}/nist_800_53-${framework_revision}/enterprise/` +
      `nist_800_53-${framework_revision}_attack-${attack_version}-enterprise.json`
    );
  },
};
