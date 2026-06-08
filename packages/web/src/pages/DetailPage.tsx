import { trpc } from "@/lib/trpc.js";
import { AttackChainView } from "@/components/AttackChainView.js";
import { SelfAssessmentPanel } from "@/components/SelfAssessmentPanel.js";
import { VerdictPanel } from "@/components/VerdictPanel.js";
import { EvidenceBadge } from "@/components/EvidenceBadge.js";
import { SeverityBadge } from "@/components/SeverityBadge.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Button } from "@/components/ui/button.js";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";

interface Props {
  incidentId: number;
  onBack: () => void;
}

export function DetailPage({ incidentId, onBack }: Props) {
  const query = trpc.reconstruction.get.useQuery({ id: incidentId });

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-sm text-destructive">
            {query.error?.message ?? "Incident not found."}
          </p>
        </main>
      </div>
    );
  }

  const out = query.data as unknown as ReconstructionOutput;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">{out.incident.name}</h1>
            <SeverityBadge result={out.verdict.result} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section>
          <VerdictPanel verdict={out.verdict} />
        </section>

        <section>
          <Card>
            <CardContent className="pt-6 space-y-2">
              {out.incident.actor && (
                <p className="text-sm text-muted-foreground">Actor: {out.incident.actor}</p>
              )}
              <p className="text-sm">{out.incident.summary}</p>
              {out.incident.source_quality_note && (
                <p className="text-xs text-muted-foreground italic">
                  {out.incident.source_quality_note}
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Attack Chain</h2>
          <AttackChainView steps={out.attack_chain} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Generalised Pattern</h2>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="font-medium">{out.generalised_pattern.title}</p>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Preconditions
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {out.generalised_pattern.preconditions.map((p, i) => (
                    <li key={i} className="text-sm">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                {out.generalised_pattern.chain_summary}
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Inferable Control Gaps</h2>
          <div className="space-y-2">
            {out.inferable_control_gaps.map((gap, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-4 flex items-start gap-3">
                  <EvidenceBadge tier={gap.evidence_tier} />
                  <p className="text-sm">{gap.gap}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Self-Assessment Questionnaire</h2>
          <SelfAssessmentPanel entries={out.self_assessment} />
        </section>

        {out.version_log.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Version Log</h2>
            <Card>
              <CardContent className="pt-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 font-medium">Claim</th>
                      <th className="text-left pb-2 font-medium">Old tier</th>
                      <th className="text-left pb-2 font-medium">New tier</th>
                      <th className="text-left pb-2 font-medium">Superseding source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {out.version_log.map((entry, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 pr-3">{entry.claim}</td>
                        <td className="py-1.5 pr-3">
                          <EvidenceBadge tier={entry.old_tier} />
                        </td>
                        <td className="py-1.5 pr-3">
                          <EvidenceBadge tier={entry.new_tier} />
                        </td>
                        <td className="py-1.5 text-muted-foreground">
                          {entry.superseding_source}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
