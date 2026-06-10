import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { CheckCircle2, AlertTriangle, XCircle, Minus } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { IncidentReportPDF } from "@/components/IncidentReportPDF.js";
import { pdf } from "@react-pdf/renderer";
import type { ReconstructionOutput, AttackChainStep } from "../../../engine/src/schema.js";
import type { AnswerMap, AssessmentAnswer } from "../../../store/src/types.js";

interface Props {
  assessmentId: number;
  onBack: () => void;
}

type AnswerToggle = "yes" | "partial" | "no";

function computeVerdict(
  steps: AttackChainStep[],
  answers: AnswerMap,
): { type: "stopped"; step: number; controlName: string } | { type: "succeeds" } | { type: "incomplete" } {
  // Find the earliest step with a 'yes' PREVENT control
  for (const step of steps) {
    const key = String(step.step);
    const answer = answers[key];
    if (answer === "yes") {
      const preventControl = step.breaking_controls.find((c) => c.axis === "prevent");
      if (preventControl) {
        return { type: "stopped", step: step.step, controlName: preventControl.description };
      }
    }
  }
  const anyAnswered = steps.some((s) => answers[String(s.step)] !== undefined);
  if (!anyAnswered) return { type: "incomplete" };
  // All answered with no PREVENT yes — attack would succeed
  const allAnswered = steps.every((s) => answers[String(s.step)] !== undefined);
  if (allAnswered) return { type: "succeeds" };
  return { type: "incomplete" };
}

function StatusIcon({ answer }: { answer: AssessmentAnswer | undefined }) {
  if (answer === "yes") return <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" aria-label="Yes" />;
  if (answer === "partial") return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" aria-label="Partial" />;
  if (answer === "no") return <XCircle className="h-5 w-5 text-red-600 shrink-0" aria-label="No" />;
  return <Minus className="h-5 w-5 text-muted-foreground shrink-0" aria-label="Unanswered" />;
}

const TOGGLE_LABELS: { value: AnswerToggle; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partial", label: "Partial" },
  { value: "no", label: "No" },
];

export function AssessmentPage({ assessmentId, onBack }: Props) {
  const query = trpc.assessment.get.useQuery({ id: assessmentId });
  const saveAnswers = trpc.assessment.saveAnswers.useMutation();

  const [localAnswers, setLocalAnswers] = useState<AnswerMap>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);
  const initialised = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialise local answers from DB on first load
  useEffect(() => {
    if (query.data?.assessment && !initialised.current) {
      setLocalAnswers(query.data.assessment.answers as AnswerMap);
      initialised.current = true;
    }
  }, [query.data]);

  const persistAnswers = useCallback(
    (answers: AnswerMap) => {
      saveAnswers.mutate(
        { id: assessmentId, answers },
        { onSuccess: () => setSavedAt(new Date()) },
      );
    },
    [assessmentId, saveAnswers],
  );

  async function handleExport() {
    if (!query.data) return;
    setExporting(true);
    try {
      const { client, result, incident_name: incidentName } = query.data;
      const out = result as unknown as ReconstructionOutput;
      const blob = await pdf(
        <IncidentReportPDF
          out={out}
          incidentDate={null}
          clientAssessment={{
            client_name: client?.name ?? "Unknown",
            client_sector: client?.sector ?? null,
            tech_stack_notes: client?.tech_stack_notes ?? null,
            assessment_date: new Date().toISOString(),
            answers: localAnswers,
          }}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(client?.name ?? "client").replace(/\s+/g, "_")}_${incidentName.replace(/\s+/g, "_")}_assessment.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleToggle(stepKey: string, value: AnswerToggle) {
    const updated = { ...localAnswers, [stepKey]: value };
    setLocalAnswers(updated);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => persistAnswers(updated), 500);
  }

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
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
          <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-sm text-destructive">
            {query.error?.message ?? "Assessment not found."}
          </p>
        </main>
      </div>
    );
  }

  const { client, result, incident_name } = query.data;
  const out = result as unknown as ReconstructionOutput;
  const steps = out.attack_chain;
  const verdict = computeVerdict(steps, localAnswers);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">
              {client?.name ?? "Unknown Client"}
              {client?.sector && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  — {client.sector}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">{incident_name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {savedAt && (
              <p className="text-xs text-muted-foreground">
                Saved {savedAt.toLocaleTimeString()}
              </p>
            )}
            <Button variant="outline" size="sm" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? "Generating…" : "Export PDF"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Live verdict panel */}
        <section>
          <Card className={cn(
            "border-2",
            verdict.type === "stopped" && "border-green-500",
            verdict.type === "succeeds" && "border-red-500",
            verdict.type === "incomplete" && "border-muted",
          )}>
            <CardContent className="pt-6 pb-5">
              {verdict.type === "stopped" && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-green-700">Attack stopped</p>
                    <p className="text-sm mt-1">
                      Based on your answers, this attack would be stopped at Step {verdict.step}{" "}
                      (PREVENT — {verdict.controlName})
                    </p>
                  </div>
                </div>
              )}
              {verdict.type === "succeeds" && (
                <div className="flex items-start gap-3">
                  <XCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-red-700">Attack would likely succeed</p>
                    <p className="text-sm mt-1">
                      Based on your answers, this attack would likely succeed — no controls address the critical path.
                    </p>
                  </div>
                </div>
              )}
              {verdict.type === "incomplete" && (
                <div className="flex items-start gap-3">
                  <Minus className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Assessment in progress</p>
                    <p className="text-sm mt-1 text-muted-foreground">
                      Answer all questions below to see your verdict.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Self-assessment questions with yes/partial/no toggles */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Self-Assessment Questions</h2>
          <div className="space-y-3">
            {out.self_assessment.map((entry, i) => {
              const stepKey = String(entry.maps_to_step);
              const current = localAnswers[stepKey];
              return (
                <Card key={i}>
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <p className="text-sm font-medium">{entry.question}</p>
                    <p className="text-xs text-muted-foreground">
                      Step {entry.maps_to_step} · {entry.framework_ref}
                    </p>
                    <div className="flex gap-2" role="group" aria-label={`Answer for step ${entry.maps_to_step}`}>
                      {TOGGLE_LABELS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleToggle(stepKey, value)}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            current === value
                              ? value === "yes"
                                ? "bg-green-600 text-white border-green-600"
                                : value === "partial"
                                  ? "bg-amber-500 text-white border-amber-500"
                                  : "bg-red-600 text-white border-red-600"
                              : "bg-background text-foreground border-input hover:bg-muted",
                          )}
                          aria-pressed={current === value}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Gap analysis panel */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Gap Analysis</h2>
          <div className="space-y-2">
            {steps.map((step) => {
              const stepKey = String(step.step);
              const answer = localAnswers[stepKey] as AssessmentAnswer | undefined;
              const isGap = answer === "no" || answer === undefined;
              const preventControl = step.breaking_controls.find((c) => c.axis === "prevent");
              return (
                <Card
                  key={step.step}
                  className={cn(
                    "border",
                    isGap ? "border-red-200 bg-red-50/30" : "",
                  )}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <StatusIcon answer={answer} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          Step {step.step}: {step.what_happened}
                        </p>
                        {preventControl && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Breaking control: {preventControl.description}
                          </p>
                        )}
                        {!preventControl && step.breaking_controls[0] && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {step.breaking_controls[0].axis.charAt(0).toUpperCase() +
                              step.breaking_controls[0].axis.slice(1)}: {step.breaking_controls[0].description}
                          </p>
                        )}
                        {step.breaking_controls.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            No mapped control available for this technique.
                          </p>
                        )}
                      </div>
                      {isGap && (
                        <span className="text-xs font-medium text-red-600 shrink-0 mt-0.5">GAP</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
