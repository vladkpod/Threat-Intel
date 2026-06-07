import { EvidenceBadge } from "./EvidenceBadge.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";

type VerdictData = ReconstructionOutput["verdict"];

const RESULT_STYLES: Record<string, { label: string; className: string }> = {
  would_likely_fail: {
    label: "Would likely FAIL",
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  would_likely_succeed: {
    label: "Would likely SUCCEED",
    className: "text-red-700 bg-red-50 border-red-200",
  },
  indeterminate: {
    label: "INDETERMINATE",
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  indeterminate_pending_confirmation: {
    label: "INDETERMINATE — pending confirmation",
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
};

const AXIS_COLOURS: Record<string, string> = {
  prevent: "bg-red-100 text-red-800 border-transparent",
  detect: "bg-yellow-100 text-yellow-800 border-transparent",
  respond: "bg-blue-100 text-blue-800 border-transparent",
};

export function VerdictPanel({ verdict }: { verdict: VerdictData }) {
  const style = RESULT_STYLES[verdict.result] ?? RESULT_STYLES["indeterminate"]!;

  return (
    <Card className={`border ${style.className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-3">
          <span>Verdict</span>
          <span className={`text-base font-bold ${style.className} border rounded px-2 py-0.5`}>
            {style.label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Confidence:</span>
            <EvidenceBadge tier={verdict.confidence} />
          </div>
          {verdict.earliest_breakable_step !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Earliest break at step:</span>
              <Badge variant="outline">{verdict.earliest_breakable_step}</Badge>
            </div>
          )}
          {verdict.break_axis !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Break axis:</span>
              <Badge
                variant="outline"
                className={AXIS_COLOURS[verdict.break_axis] ?? ""}
              >
                {verdict.break_axis}
              </Badge>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Method
          </p>
          <p className="text-sm text-muted-foreground">{verdict.method}</p>
        </div>

        {verdict.caveats.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              Caveats
            </p>
            <ul className="space-y-1">
              {verdict.caveats.map((c, i) => (
                <li
                  key={i}
                  className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1"
                >
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
