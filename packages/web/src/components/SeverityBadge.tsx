import { Badge } from "@/components/ui/badge.js";
import type { VerdictResult } from "../../../engine/src/schema.js";

type Severity = "HIGH" | "MEDIUM" | "LOW";

function verdictToSeverity(result: VerdictResult): Severity {
  if (result === "would_likely_succeed") return "HIGH";
  if (result === "would_likely_fail") return "LOW";
  return "MEDIUM";
}

export function SeverityBadge({ result }: { result: VerdictResult }) {
  const severity = verdictToSeverity(result);
  const variant =
    severity === "HIGH"
      ? "destructive"
      : severity === "LOW"
        ? "confirmed"
        : "inferred";
  return <Badge variant={variant}>{severity}</Badge>;
}
