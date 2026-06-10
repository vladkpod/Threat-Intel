import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc.js";
import { AttackChainView } from "@/components/AttackChainView.js";
import { SelfAssessmentPanel } from "@/components/SelfAssessmentPanel.js";
import { VerdictPanel } from "@/components/VerdictPanel.js";
import { EvidenceBadge } from "@/components/EvidenceBadge.js";
import { SeverityBadge } from "@/components/SeverityBadge.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.js";
import { Textarea } from "@/components/ui/textarea.js";
import { IncidentReportPDF } from "@/components/IncidentReportPDF.js";
import { pdf } from "@react-pdf/renderer";
import { SECTOR_OPTIONS } from "@/lib/sectors.js";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";

interface Props {
  incidentId: number;
  onBack: () => void;
  onOpenAssessment: (assessmentId: number) => void;
}

export function DetailPage({ incidentId, onBack, onOpenAssessment }: Props) {
  const query = trpc.reconstruction.get.useQuery({ id: incidentId });
  const [exporting, setExporting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientSector, setClientSector] = useState("");
  const [techNotes, setTechNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const existingAssessments = trpc.assessment.listForReconstruction.useQuery(
    { reconstruction_id: incidentId },
    { enabled: !query.isLoading && !query.error },
  );

  const createAssessment = trpc.assessment.create.useMutation({
    onSuccess: (data) => {
      setModalOpen(false);
      setClientName("");
      setClientSector("");
      setTechNotes("");
      void existingAssessments.refetch();
      onOpenAssessment(data.assessment_id);
    },
    onError: (err) => {
      setFormError(err.message);
    },
  });

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

  const data = query.data;
  const out = data?.result as unknown as ReconstructionOutput;
  const incidentDate = data?.incident_date ?? null;

  async function handleExport() {
    if (!out) return;
    setExporting(true);
    try {
      const blob = await pdf(
        <IncidentReportPDF out={out} incidentDate={incidentDate} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${out.incident.name.replace(/\s+/g, "_")}_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report exported");
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  function handleSubmitAssessment(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!clientName.trim()) {
      setFormError("Client name is required.");
      return;
    }
    createAssessment.mutate({
      client_name: clientName.trim(),
      client_sector: clientSector || undefined,
      tech_stack_notes: techNotes || undefined,
      reconstruction_id: incidentId,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-xl font-bold tracking-tight">{out.incident.name}</h1>
            <SeverityBadge result={out.verdict.result} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
              New Assessment
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? "Generating…" : "Export Report"}
            </Button>
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
          <SelfAssessmentPanel entries={out.self_assessment} reconstructionId={incidentId} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Client Assessments</h2>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
              + New Assessment
            </Button>
          </div>
          {existingAssessments.isLoading && (
            <p className="text-sm text-muted-foreground">Loading assessments…</p>
          )}
          {!existingAssessments.isLoading && (existingAssessments.data?.length ?? 0) === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3 border rounded-lg border-dashed">
              <Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">No client assessments yet</p>
              <p className="text-xs text-muted-foreground">
                Create a new assessment to assess a client against this attack chain.
              </p>
              <Button size="sm" onClick={() => setModalOpen(true)}>
                New Assessment
              </Button>
            </div>
          )}
          {(existingAssessments.data?.length ?? 0) > 0 && (
            <div className="space-y-2">
              {existingAssessments.data?.map((a) => (
                <Card key={a.id} className="cursor-pointer hover:bg-muted/40 transition-colors">
                  <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{a.client_name}</p>
                      {a.client_sector && (
                        <p className="text-xs text-muted-foreground">{a.client_sector}</p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onOpenAssessment(a.id)}>
                      Open
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {out.version_log.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Incident Timeline</h2>
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" aria-hidden="true" />
              {[...out.version_log].reverse().map((entry, i) => (
                <div key={i} className="relative flex gap-4 mb-5 last:mb-0">
                  {/* Dot */}
                  <div
                    className="absolute -left-[3px] top-1.5 w-3 h-3 rounded-full bg-foreground border-2 border-background shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {entry.claim} — upgraded{" "}
                      <span className="font-medium text-foreground">{entry.old_tier}</span>
                      {" → "}
                      <span className="font-medium text-foreground">{entry.new_tier}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Source: {entry.superseding_source}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Client Assessment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitAssessment} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="client-name">Client name *</Label>
              <Input
                id="client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Acme Corp"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-sector">Sector</Label>
              <Select value={clientSector} onValueChange={setClientSector}>
                <SelectTrigger id="client-sector">
                  <SelectValue placeholder="Select sector…" />
                </SelectTrigger>
                <SelectContent>
                  {SECTOR_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tech-notes">Technology stack notes</Label>
              <Textarea
                id="tech-notes"
                value={techNotes}
                onChange={(e) => setTechNotes(e.target.value)}
                placeholder="e.g. Microsoft 365, Azure AD, on-prem Active Directory…"
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">{techNotes.length}/500</p>
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={createAssessment.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createAssessment.isPending}>
                {createAssessment.isPending ? "Creating…" : "Start Assessment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
