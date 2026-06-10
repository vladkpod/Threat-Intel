import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { SectorSummary } from "../../../sector/src/schema.js";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 20 },
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  paragraph: { marginBottom: 6, lineHeight: 1.5 },
  kevRow: {
    marginBottom: 5,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#d97706",
  },
  controlLine: { marginBottom: 4, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: "#2563eb" },
});

function sectorDisplayName(sector: string): string {
  return sector
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildSummaryParagraph(summary: SectorSummary): string {
  const sectorName = sectorDisplayName(summary.sector);
  const topGroup = summary.threat_groups[0];
  const topTechnique = summary.top_techniques[0];
  const kevCount = summary.kev_count;

  const parts: string[] = [];
  parts.push(`The ${sectorName} sector is currently targeted by ${summary.threat_group_count} known threat group${summary.threat_group_count !== 1 ? "s" : ""}.`);
  if (topGroup) {
    parts.push(`The most active group is ${topGroup.name}${topGroup.aliases.length > 0 ? ` (also known as ${topGroup.aliases.slice(0, 2).join(", ")})` : ""}.`);
  }
  if (topTechnique) {
    parts.push(`The most commonly observed technique is ${topTechnique.name}, used across ${topTechnique.count} group${topTechnique.count !== 1 ? "s" : ""}.`);
  }
  if (kevCount > 0) {
    parts.push(`There are ${kevCount} known-exploited vulnerabilities (KEVs) associated with this sector's threat landscape.`);
  }
  return parts.join(" ");
}

interface Props {
  summary: SectorSummary;
  briefDate: string;
}

export function SectorBriefPDF({ summary, briefDate }: Props) {
  const sectorName = sectorDisplayName(summary.sector);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Threat Intelligence Brief — {sectorName} — {briefDate}</Text>
        <Text style={styles.subtitle}>
          Prepared by Waterstons · {formatDate(new Date().toISOString())}
        </Text>

        {/* Paragraph 1: Sector threat summary */}
        <Text style={styles.sectionHeading}>Sector Threat Summary</Text>
        <Text style={styles.paragraph}>{buildSummaryParagraph(summary)}</Text>

        {/* Paragraph 2: Recent advisories (KEVs) */}
        <Text style={styles.sectionHeading}>
          Recent Advisories ({summary.kev_count} Known Exploited Vulnerabilities)
        </Text>
        {summary.recent_kevs.length === 0 && (
          <Text style={[styles.paragraph, { color: "#555" }]}>No recent KEVs recorded for this sector.</Text>
        )}
        {summary.recent_kevs.slice(0, 10).map((kev) => (
          <View key={kev.cveID} style={styles.kevRow}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 1 }}>
              {kev.cveID} — {kev.dateAdded}
            </Text>
            <Text style={{ fontSize: 9 }}>{kev.vulnerabilityName}</Text>
            <Text style={{ fontSize: 8, color: "#555" }}>
              {kev.vendorProject} — {kev.product}
              {kev.knownRansomwareCampaignUse === "Known" ? " · Linked to ransomware campaigns" : ""}
            </Text>
          </View>
        ))}

        {/* Paragraph 3: Recommended priority controls */}
        <Text style={styles.sectionHeading}>Recommended Priority Controls</Text>
        <Text style={[styles.paragraph, { color: "#555" }]}>
          The following controls address the top techniques observed in this sector.
          Implement and validate these controls as a priority.
        </Text>
        {summary.top_techniques.slice(0, 2).map((t) => (
          <View key={t.technique_id} style={styles.controlLine}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 1 }}>
              {t.name} (used by {t.count} group{t.count !== 1 ? "s" : ""})
            </Text>
            <Text style={{ fontSize: 9, color: "#333" }}>
              Review MITRE ATT&CK mitigations for this technique. Ensure detective controls
              and response playbooks are in place and tested.
            </Text>
          </View>
        ))}
        {summary.top_techniques.length === 0 && (
          <Text style={[styles.paragraph, { color: "#555" }]}>
            Insufficient technique data to generate specific recommendations for this sector.
          </Text>
        )}

        <Text style={[styles.paragraph, { color: "#777", fontSize: 8, marginTop: 20 }]}>
          This brief is generated from public ATT&CK and CISA KEV data. It reflects
          observed sector targeting patterns, not confirmed incidents at your organisation.
          Consult your security team before prioritising remediation.
        </Text>
      </Page>
    </Document>
  );
}
