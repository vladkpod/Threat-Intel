import { Badge } from "@/components/ui/badge.js";

type Tier = "CONFIRMED" | "REPORTED" | "INFERRED" | "ANALOGOUS";

const TIER_VARIANT: Record<Tier, "confirmed" | "reported" | "inferred" | "analogous"> = {
  CONFIRMED: "confirmed",
  REPORTED: "reported",
  INFERRED: "inferred",
  ANALOGOUS: "analogous",
};

export function EvidenceBadge({ tier }: { tier: Tier }) {
  return <Badge variant={TIER_VARIANT[tier]}>{tier}</Badge>;
}
