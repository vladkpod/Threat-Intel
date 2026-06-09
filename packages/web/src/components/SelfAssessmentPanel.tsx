import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.js";
import { Badge } from "@/components/ui/badge.js";
import { EvidenceBadge } from "./EvidenceBadge.js";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";

type Entry = ReconstructionOutput["self_assessment"][number];

const TESTABILITY_COLOURS: Record<string, string> = {
  "BAS-validatable": "bg-emerald-100 text-emerald-800 border-transparent",
  "red-team-validatable": "bg-violet-100 text-violet-800 border-transparent",
  "self-reported-only": "bg-slate-100 text-slate-600 border-transparent",
};

const AXIS_COLOURS: Record<string, string> = {
  prevent: "bg-red-50 text-red-700 border-red-200",
  detect: "bg-yellow-50 text-yellow-700 border-yellow-200",
  respond: "bg-blue-50 text-blue-700 border-blue-200",
};

function getAxis(frameworkRef: string): string {
  if (frameworkRef.toLowerCase().includes("detect")) return "detect";
  if (frameworkRef.toLowerCase().includes("respond")) return "respond";
  return "prevent";
}

function EntryCard({ entry, index }: { entry: Entry; index: number }) {
  const axis = getAxis(entry.framework_ref);
  return (
    <AccordionItem value={`entry-${index}`}>
      <AccordionTrigger className="text-left">
        <div className="flex items-start gap-3 pr-4">
          <div className="flex gap-1.5 shrink-0 mt-0.5">
            <Badge
              variant="outline"
              className={`text-[10px] py-0 ${AXIS_COLOURS[axis] ?? ""}`}
            >
              Step {entry.maps_to_step}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] py-0 ${TESTABILITY_COLOURS[entry.testability] ?? ""}`}
            >
              {entry.testability}
            </Badge>
            <EvidenceBadge tier={entry.evidence_tier_of_underlying_step} />
          </div>
          <span className="text-sm">{entry.question}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pl-2">
          <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3">
            <p className="text-xs font-semibold text-emerald-700 mb-1">
              Resilient looks like
            </p>
            <p className="text-sm text-emerald-900">{entry.resilient_looks_like}</p>
          </div>
          <div className="rounded-md bg-rose-50 border border-rose-200 p-3">
            <p className="text-xs font-semibold text-rose-700 mb-1">
              Vulnerable looks like
            </p>
            <p className="text-sm text-rose-900">{entry.vulnerable_looks_like}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Framework ref: {entry.framework_ref} · Basis: {entry.mapping_basis}
          </p>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

const STORAGE_KEY_PREFIX = "self-assessment-open:";

export function SelfAssessmentPanel({
  entries,
  reconstructionId,
}: {
  entries: ReconstructionOutput["self_assessment"];
  reconstructionId: number;
}) {
  const storageKey = `${STORAGE_KEY_PREFIX}${reconstructionId}`;
  const [openItems, setOpenItems] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(openItems));
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, [openItems, storageKey]);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No self-assessment questions generated.
      </p>
    );
  }

  return (
    <Accordion
      type="multiple"
      value={openItems}
      onValueChange={setOpenItems}
      className="w-full"
    >
      {entries.map((entry, i) => (
        <EntryCard key={i} entry={entry} index={i} />
      ))}
    </Accordion>
  );
}
