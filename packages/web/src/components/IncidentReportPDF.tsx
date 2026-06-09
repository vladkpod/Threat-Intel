import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";

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
});

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date unknown";
  return new Date(dateStr).toLocaleDateString("en-GB", {
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

interface Props {
  out: ReconstructionOutput;
  incidentDate: string | null;
}

export function IncidentReportPDF({ out, incidentDate }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Section 1: Title, date, actor */}
        <Text style={styles.title}>{out.incident.name}</Text>
        <Text style={styles.subtitle}>
          Threat Intelligence Reconstruction Report · {formatDate(incidentDate)}
        </Text>

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

        {/* Section 4: Self-assessment questions */}
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

        {/* Section 5: Caveats (repeated at end for prominence) */}
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
