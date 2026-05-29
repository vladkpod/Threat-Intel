export * from "./types.js";
export { baseAdmissibility, admitForClaim } from "./admissibility.js";
export {
  computeCorroboration,
  type ClaimSourceInput,
  type CorroborationResult,
  type SourceContribution,
} from "./independence.js";
export { computeTier, type TierSourceInput, type TierResult } from "./tiering.js";
export {
  SOURCE_REGISTRY,
  DEFAULT_ENTRY,
  classifySource,
  type RegistryEntry,
} from "./source-authority.js";
export { CTID_PIN, type CtidPin } from "./ctid/version.js";
export {
  CtidMappings,
  CtidDocument,
  type ControlLink,
} from "./ctid/loader.js";
