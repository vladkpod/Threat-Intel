import { Card, CardContent, CardHeader } from "@/components/ui/card.js";
import { SeverityBadge } from "@/components/SeverityBadge.js";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";

function stripSourceSuffix(text: string): string {
  return text.replace(/\s+Source\(s\):.*$/, ".");
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
  const firstSentence = stripSourceSuffix(first.what_happened);
  if (!last || last === first) return firstSentence;
  const lastSentence = stripSourceSuffix(last.what_happened);
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

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onClick(id)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-base leading-snug">{incidentName}</h3>
          <SeverityBadge result={result.verdict.result} />
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
          <span>{actor}</span>
          <span>·</span>
          <span>Sector unspecified</span>
          <span>·</span>
          <span>{date}</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">{summary}</p>
      </CardContent>
    </Card>
  );
}
