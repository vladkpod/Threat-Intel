import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";
import type { AnswerMap } from "../../../store/src/types.js";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 24 },
  sectionHeading: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { fontFamily: "Helvetica-Bold", width: 80 },
  value: { flex: 1 },
  paragraph: { marginBottom: 6, lineHeight: 1.5 },
  stepBox: {
    marginBottom: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#888",
  },
  stepHeader: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  controlLine: { marginLeft: 8, marginBottom: 2, color: "#333" },
  questionBox: {
    marginBottom: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 3,
  },
  questionText: { fontFamily: "Helvetica-Bold", marginBottom: 4 },
  answerBox: {
    height: 36,
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 2,
    marginTop: 4,
  },
  caveatBox: {
    marginTop: 4,
    marginBottom: 4,
    padding: 6,
    backgroundColor: "#fffbeb",
    borderLeftWidth: 2,
    borderLeftColor: "#f59e0b",
  },
  verdictLabel: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  coverBox: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    marginBottom: 20,
    backgroundColor: "#f9fafb",
  },
  gapRow: {
    marginBottom: 6,
    padding: 6,
    borderLeftWidth: 3,
  },
  gapRowGreen: { borderLeftColor: "#16a34a" },
  gapRowAmber: { borderLeftColor: "#d97706" },
  gapRowRed: { borderLeftColor: "#dc2626", backgroundColor: "#fff1f2" },
  gapRowGrey: { borderLeftColor: "#9ca3af", backgroundColor: "#f9fafb" },
  priorityBox: {
    marginBottom: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fff1f2",
    borderRadius: 3,
  },
});

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Date unknown";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function stripSourceSuffix(text: string): string {
  return text.replace(/\s+Source\(s\):.*$/, ".");
}

function verdictLabel(result: ReconstructionOutput["verdict"]["result"]): string {
  switch (result) {
    case "would_likely_succeed": return "Would likely SUCCEED against this organisation";
    case "would_likely_fail": return "Would likely FAIL against this organisation";
    case "indeterminate": return "INDETERMINATE — insufficient evidence to assess";
    case "indeterminate_pending_confirmation": return "INDETERMINATE — pending source confirmation";
  }
}

function answerLabel(answer: string | undefined): string {
  if (answer === "yes") return "Yes ✓";
  if (answer === "partial") return "Partial ~";
  if (answer === "no") return "No ✗";
  return "Unanswered";
}

export interface ClientAssessmentData {
  client_name: string;
  client_sector: string | null;
  tech_stack_notes: string | null;
  assessment_date: string;
  answers: AnswerMap;
}

interface Props {
  out: ReconstructionOutput;
  incidentDate: string | null;
  clientAssessment?: ClientAssessmentData;
}

export function IncidentReportPDF({ out, incidentDate, clientAssessment }: Props) {
  const isClientReport = clientAssessment !== undefined;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Section 1: Title, date, actor */}
        <Text style={styles.title}>
          {isClientReport
            ? `${clientAssessment.client_name} — Threat Assessment Report`
            : out.incident.name}
        </Text>
        <Text style={styles.subtitle}>
          {isClientReport
            ? `Incident: ${out.incident.name} · ${formatDate(incidentDate)}`
            : `Threat Intelligence Reconstruction Report · ${formatDate(incidentDate)}`}
        </Text>

        {/* Client cover block */}
        {isClientReport && (
          <View style={styles.coverBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Client:</Text>
              <Text style={styles.value}>{clientAssessment.client_name}</Text>
            </View>
            {clientAssessment.client_sector && (
              <View style={styles.row}>
                <Text style={styles.label}>Sector:</Text>
                <Text style={styles.value}>{clientAssessment.client_sector}</Text>
              </View>
            )}
            {clientAssessment.tech_stack_notes && (
              <View style={styles.row}>
                <Text style={styles.label}>Technology:</Text>
                <Text style={styles.value}>{clientAssessment.tech_stack_notes}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>Assessed:</Text>
              <Text style={styles.value}>{formatDate(clientAssessment.assessment_date)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Prepared by:</Text>
              <Text style={styles.value}>Waterstons</Text>
            </View>
          </View>
        )}

        {!isClientReport && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Actor:</Text>
              <Text style={styles.value}>{out.incident.actor}</Text>
            </View>
            {incidentDate && (
              <View style={styles.row}>
                <Text style={styles.label}>Date:</Text>
                <Text style={styles.value}>{formatDate(incidentDate)}</Text>
              </View>
            )}
          </>
        )}
        <Text style={[styles.paragraph, { marginTop: 8 }]}>{out.incident.summary}</Text>
        {out.incident.source_quality_note && (
          <Text style={[styles.paragraph, { color: "#555", fontSize: 9 }]}>
            {out.incident.source_quality_note}
          </Text>
        )}

        {/* Section 2: Verdict */}
        <Text style={styles.sectionHeading}>Verdict</Text>
        <Text style={styles.verdictLabel}>{verdictLabel(out.verdict.result)}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Confidence:</Text>
          <Text style={styles.value}>{out.verdict.confidence}</Text>
        </View>
        {out.verdict.earliest_breakable_step && (
          <View style={styles.row}>
            <Text style={styles.label}>Break at:</Text>
            <Text style={styles.value}>
              Step {out.verdict.earliest_breakable_step} ({out.verdict.break_axis ?? "unknown"} axis)
            </Text>
          </View>
        )}
        {out.verdict.caveats.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Caveats:</Text>
            {out.verdict.caveats.map((c, i) => (
              <View key={i} style={styles.caveatBox}>
                <Text>{c}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Section 3: Attack chain */}
        <Text style={styles.sectionHeading}>Attack Chain</Text>
        {out.attack_chain.map((step) => (
          <View key={step.step} style={styles.stepBox}>
            <Text style={styles.stepHeader}>
              Step {step.step} — {step.attack_tactic} [{step.evidence_tier}]
            </Text>
            <Text style={styles.paragraph}>
              {stripSourceSuffix(step.what_happened)}
            </Text>
            {step.breaking_controls.length > 0 && (
              <View>
                <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
                  Breaking controls:
                </Text>
                {step.breaking_controls.map((bc, i) => (
                  <Text key={i} style={styles.controlLine}>
                    [{bc.axis.toUpperCase()}] {bc.description} ({bc.framework_ref})
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Client-only: Gap Analysis */}
        {isClientReport && (
          <>
            <Text style={styles.sectionHeading}>Gap Analysis</Text>
            <Text style={[styles.paragraph, { color: "#555" }]}>
              Status of each attack chain step based on your assessment responses.
            </Text>
            {out.attack_chain.map((step) => {
              const answer = clientAssessment.answers[String(step.step)];
              const preventControl = step.breaking_controls.find((c) => c.axis === "prevent");
              const controlText = preventControl?.description
                ?? step.breaking_controls[0]?.description
                ?? "No mapped control";
              const rowStyle =
                answer === "yes" ? styles.gapRowGreen
                : answer === "partial" ? styles.gapRowAmber
                : answer === "no" ? styles.gapRowRed
                : styles.gapRowGrey;
              return (
                <View key={step.step} style={[styles.gapRow, rowStyle]}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>
                    Step {step.step}: {answerLabel(answer)}
                  </Text>
                  <Text style={{ fontSize: 9, marginTop: 1 }}>
                    {stripSourceSuffix(step.what_happened)}
                  </Text>
                  <Text style={{ fontSize: 9, color: "#555", marginTop: 1 }}>
                    Control: {controlText}
                  </Text>
                </View>
              );
            })}

            {/* Priority Actions */}
            <Text style={styles.sectionHeading}>Priority Actions</Text>
            <Text style={[styles.paragraph, { color: "#555" }]}>
              Top unaddressed steps requiring attention, in attack chain order.
            </Text>
            {(() => {
              const gaps = out.attack_chain
                .filter((s) => {
                  const a = clientAssessment.answers[String(s.step)];
                  return a === "no" || a === undefined;
                })
                .slice(0, 3);
              if (gaps.length === 0) {
                return <Text style={styles.paragraph}>No critical gaps identified.</Text>;
              }
              return gaps.map((step, i) => {
                const preventControl = step.breaking_controls.find((c) => c.axis === "prevent");
                return (
                  <View key={step.step} style={styles.priorityBox}>
                    <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
                      {i + 1}. Step {step.step}: {step.attack_tactic}
                    </Text>
                    <Text style={{ fontSize: 9 }}>{stripSourceSuffix(step.what_happened)}</Text>
                    {preventControl && (
                      <Text style={{ fontSize: 9, color: "#555", marginTop: 2 }}>
                        Recommended control: {preventControl.description} ({preventControl.framework_ref})
                      </Text>
                    )}
                  </View>
                );
              });
            })()}
          </>
        )}

        {/* Section 4: Self-assessment questions (generic only) */}
        {!isClientReport && (
          <>
            <Text style={styles.sectionHeading}>Self-Assessment Questionnaire</Text>
            <Text style={[styles.paragraph, { color: "#555" }]}>
              Complete the boxes below to assess your organisation's exposure to this attack pattern.
            </Text>
            {out.self_assessment.map((entry, i) => (
              <View key={i} style={styles.questionBox}>
                <Text style={styles.questionText}>
                  Q{i + 1}. {entry.question}
                </Text>
                <View style={styles.row}>
                  <Text style={{ color: "#555", fontSize: 9, flex: 1 }}>
                    Resilient: {entry.resilient_looks_like}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={{ color: "#555", fontSize: 9, flex: 1 }}>
                    Vulnerable: {entry.vulnerable_looks_like}
                  </Text>
                </View>
                <Text style={{ fontSize: 9, color: "#888", marginTop: 3 }}>
                  Your answer:
                </Text>
                <View style={styles.answerBox} />
              </View>
            ))}
          </>
        )}

        {/* Section 5: Caveats */}
        {out.verdict.caveats.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Important Caveats</Text>
            {out.verdict.caveats.map((c, i) => (
              <View key={i} style={styles.caveatBox}>
                <Text>{c}</Text>
              </View>
            ))}
            <Text style={[styles.paragraph, { color: "#555", marginTop: 8 }]}>
              This report is based on public-source evidence only. Evidence tiers reflect
              source quality, not certainty. Self-assessment responses are self-reported
              unless independently validated.
            </Text>
          </>
        )}
      </Page>
    </Document>
  );
}
