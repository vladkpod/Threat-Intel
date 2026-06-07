import { useState } from "react";
import { trpc } from "@/lib/trpc.js";
import { Button } from "@/components/ui/button.js";
import { Textarea } from "@/components/ui/textarea.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.js";
import { AttackChainView } from "@/components/AttackChainView.js";
import { SelfAssessmentPanel } from "@/components/SelfAssessmentPanel.js";
import { VerdictPanel } from "@/components/VerdictPanel.js";
import { EvidenceBadge } from "@/components/EvidenceBadge.js";

const PLACEHOLDER = JSON.stringify(
  {
    incident_name: "Example Incident",
    framework: "CIS_v8",
    client_profile: null,
    incident_sources: [
      {
        id: "S1",
        label: "Press source",
        independence_group: "G4",
        tier_ceiling: "REPORTED",
        proximity: "secondary",
        primary: true,
        derivative_of: null,
        incentive_bias: null,
        text: "Attackers socially engineered the IT help desk into resetting credentials. They then obtained the NTDS.dit Active Directory database and deployed ransomware on ESXi hypervisors.",
      },
    ],
  },
  null,
  2,
);

export function ReconstructPage() {
  const [raw, setRaw] = useState(PLACEHOLDER);
  const [parseError, setParseError] = useState<string | null>(null);

  const mutation = trpc.reconstruction.run.useMutation();

  function handleSubmit() {
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setParseError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    mutation.mutate(parsed as Parameters<typeof mutation.mutate>[0]);
  }

  const out = mutation.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">
          Threat Intelligence — Incident Reconstruction
        </h1>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder="Paste ReconstructionInput JSON..."
            />
            {parseError && (
              <p className="text-sm text-destructive">{parseError}</p>
            )}
            {mutation.error && (
              <p className="text-sm text-destructive">
                {mutation.error.message}
              </p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="w-full sm:w-auto"
            >
              {mutation.isPending ? "Reconstructing…" : "Reconstruct Incident"}
            </Button>
          </CardContent>
        </Card>

        {out && (
          <>
            <section>
              <h2 className="text-lg font-semibold mb-3">Incident</h2>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="font-medium">{out.incident.name}</p>
                  {out.incident.actor && (
                    <p className="text-sm text-muted-foreground">
                      Actor: {out.incident.actor}
                    </p>
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

            <section>
              <h2 className="text-lg font-semibold mb-3">Verdict</h2>
              <VerdictPanel verdict={out.verdict} />
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
          </>
        )}
      </main>
    </div>
  );
}
