import { Card, CardContent, CardHeader } from "@/components/ui/card.js";
import { SeverityBadge } from "@/components/SeverityBadge.js";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";
import type { VerdictResult } from "../../../engine/src/schema.js";

function severityBorderClass(result: VerdictResult): string {
  if (result === "would_likely_succeed") return "border-l-4 border-red-500";
  if (result === "would_likely_fail") return "border-l-4 border-green-500";
  return "border-l-4 border-amber-500";
}

function stripSourceSuffix(text: string): string {
  return text.replace(/\s+Source\(s\):.*$/, ".");
}

function stripTechniqueCodes(text: string): string {
  return text
    // Parenthesized blocks: "(T1566.004 / T1656)" or "(T1133 — External Remote Services)"
    .replace(/\s*\(T\d{4}(?:\.\d{3})?[^)]*\)/g, "")
    // Inline slash combos: "T1566.004 / T1656"
    .replace(/\bT\d{4}(?:\.\d{3})?(?:\s*\/\s*T\d{4}(?:\.\d{3})?)+\b/g, "")
    // Leading header: "T1133 — External Remote Services: " or "T1566.004: "
    .replace(/^T\d{4}(?:\.\d{3})?(?:\s*\/\s*T\d{4}(?:\.\d{3})?)?\s*[–—:]\s*[^:]*?:\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function deriveActor(actor: string): string {
  if (actor.startsWith("Unknown")) return "Unattributed";
  const parenIdx = actor.indexOf(" (");
  return parenIdx !== -1 ? actor.slice(0, parenIdx) : actor;
}

function deriveSummary(result: ReconstructionOutput): string {
  const first = result.attack_chain[0];
  const last = result.attack_chain[result.attack_chain.length - 1];
  if (!first) return result.incident.summary;
  const firstSentence = stripTechniqueCodes(stripSourceSuffix(first.what_happened));
  if (!last || last === first) return firstSentence;
  const lastSentence = stripTechniqueCodes(stripSourceSuffix(last.what_happened));
  return `${firstSentence} ${lastSentence}`;
}

interface Props {
  id: number;
  incidentName: string;
  createdAt: string;
  result: ReconstructionOutput;
  onClick: (id: number) => void;
}

export function IncidentFeedCard({ id, incidentName, createdAt, result, onClick }: Props) {
  const summary = deriveSummary(result);
  const actor = deriveActor(result.incident.actor);
  const date = new Date(createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const borderClass = severityBorderClass(result.verdict.result);

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md hover:border-l-[6px] ${borderClass}`}
      onClick={() => onClick(id)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <h3 className="text-lg font-semibold leading-snug flex-1">{incidentName}</h3>
          <SeverityBadge result={result.verdict.result} />
        </div>
        <div className="flex gap-2 text-sm text-muted-foreground mt-1">
          <span>{actor}</span>
          <span>·</span>
          <span className="italic">Sector unspecified</span>
          <span>·</span>
          <span>{date}</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">{summary}</p>
      </CardContent>
    </Card>
  );
}
