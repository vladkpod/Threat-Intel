import { ShieldAlert, Eye, Zap, ChevronDown } from "lucide-react";
import { EvidenceBadge } from "./EvidenceBadge.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";

type Step = ReconstructionOutput["attack_chain"][number];

const AXIS_ICONS = {
  prevent: ShieldAlert,
  detect: Eye,
  respond: Zap,
} as const;

function SourceList({ sources }: { sources: Step["sources"] }) {
  return (
    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
      {sources.map((s) => (
        <li key={s.id} className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] py-0">
            {s.independence_group}
          </Badge>
          <span>{s.label}</span>
          {!s.corroboration_contribution && (
            <span className="text-slate-400">(echo→{s.collapsed_to})</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function BreakingControlList({ controls }: { controls: Step["breaking_controls"] }) {
  const AXIS_STYLES: Record<string, string> = {
    prevent: "bg-red-50 text-red-700 border-red-200",
    detect: "bg-yellow-50 text-yellow-700 border-yellow-200",
    respond: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Breaking controls
      </p>
      {controls.map((c, i) => {
        const Icon = AXIS_ICONS[c.axis as keyof typeof AXIS_ICONS];
        return (
          <div
            key={i}
            className={`rounded border px-2 py-1.5 text-xs flex items-start gap-2 ${AXIS_STYLES[c.axis] ?? ""}`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden={true} />}
            <span>
              <span className="font-semibold uppercase mr-1.5">{c.axis}</span>
              {c.description}
              <span className="ml-1.5 opacity-60">({c.mapping_basis})</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AttackChainView({ steps }: { steps: ReconstructionOutput["attack_chain"] }) {
  if (steps.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-muted-foreground text-sm">
          No attack steps could be reconstructed from the supplied sources.
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {steps.map((step, idx) => (
        <div key={step.step}>
          {idx > 0 && (
            <div className="flex justify-center py-1.5">
              <ChevronDown className="w-4 h-4 text-muted-foreground/40" aria-hidden={true} />
            </div>
          )}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm font-mono">
                    Step {step.step}
                  </span>
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    {step.attack_technique}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {step.attack_tactic}
                  </span>
                </div>
                <EvidenceBadge tier={step.evidence_tier} />
              </div>
              <CardTitle className="text-base mt-1">{step.what_happened}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Corroborated by {step.corroboration.independence_group_count} independent group
                {step.corroboration.independence_group_count !== 1 ? "s" : ""} (
                {step.corroboration.groups.join(", ")})
              </div>
              <SourceList sources={step.sources} />
              <BreakingControlList controls={step.breaking_controls} />
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
