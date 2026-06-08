import { EvidenceBadge } from "./EvidenceBadge.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";

type VerdictData = ReconstructionOutput["verdict"];

const RESULT_CONFIG: Record<
  string,
  { label: string; borderClass: string; labelClass: string }
> = {
  would_likely_fail: {
    label: "Would likely FAIL",
    borderClass: "border-l-4 border-green-500",
    labelClass: "text-green-700",
  },
  would_likely_succeed: {
    label: "Would likely SUCCEED",
    borderClass: "border-l-4 border-red-500",
    labelClass: "text-red-700",
  },
  indeterminate: {
    label: "INDETERMINATE",
    borderClass: "border-l-4 border-amber-500",
    labelClass: "text-amber-700",
  },
  indeterminate_pending_confirmation: {
    label: "INDETERMINATE — pending confirmation",
    borderClass: "border-l-4 border-amber-500",
    labelClass: "text-amber-700",
  },
};

const AXIS_COLOURS: Record<string, string> = {
  prevent: "bg-red-100 text-red-800 border-transparent",
  detect: "bg-yellow-100 text-yellow-800 border-transparent",
  respond: "bg-blue-100 text-blue-800 border-transparent",
};

export function VerdictPanel({ verdict }: { verdict: VerdictData }) {
  const cfg = RESULT_CONFIG[verdict.result] ?? RESULT_CONFIG["indeterminate"]!;

  return (
    <Card className={cfg.borderClass}>
      <CardContent className="pt-6 space-y-4">
        <div>
          <p className={`text-xl font-bold ${cfg.labelClass}`}>{cfg.label}</p>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              Confidence: <EvidenceBadge tier={verdict.confidence} />
            </span>
            {verdict.earliest_breakable_step !== null && (
              <span className="flex items-center gap-1.5">
                Earliest break at step:
                <Badge variant="outline">{verdict.earliest_breakable_step}</Badge>
              </span>
            )}
            {verdict.break_axis !== null && (
              <span className="flex items-center gap-1.5">
                Break axis:
                <Badge
                  variant="outline"
                  className={AXIS_COLOURS[verdict.break_axis] ?? ""}
                >
                  {verdict.break_axis}
                </Badge>
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Method
          </p>
          <p className="text-sm text-muted-foreground">{verdict.method}</p>
        </div>

        {verdict.caveats.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Caveats
            </p>
            <ul className="space-y-1">
              {verdict.caveats.map((c, i) => (
                <li key={i} className="text-sm text-amber-800">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
