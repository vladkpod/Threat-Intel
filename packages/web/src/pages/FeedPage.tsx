import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc.js";
import { IncidentFeedCard } from "@/components/IncidentFeedCard.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Input } from "@/components/ui/input.js";
import { Textarea } from "@/components/ui/textarea.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.js";
import { Newspaper } from "lucide-react";

interface Props {
  onSelectIncident: (id: number) => void;
}

type FeedItem = {
  id: number;
  incident_name: string;
  incident_date: string | null;
  sector: string | null;
  result_json: {
    verdict: { result: string };
    incident: { actor: string };
  };
  created_at: string;
};

function deriveActorName(item: FeedItem): string {
  return (item.result_json as { incident?: { actor?: string } })?.incident?.actor ?? "";
}

function deriveSeverity(item: FeedItem): "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" {
  const result = (item.result_json as { verdict?: { result?: string } })?.verdict?.result ?? "";
  if (result === "would_likely_succeed") return "HIGH";
  if (result === "would_likely_fail") return "LOW";
  if (result.startsWith("indeterminate")) return "MEDIUM";
  return "UNKNOWN";
}

export function FeedPage({ onSelectIncident }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [raw, setRaw] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [allItems, setAllItems] = useState<FeedItem[]>([]);

  // Filter state
  const [filterSector, setFilterSector] = useState("ALL");
  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [filterActor, setFilterActor] = useState("");

  const query = trpc.reconstruction.list.useQuery({ cursor }, {
    onSuccess: (data) => {
      if (cursor === undefined) {
        setAllItems(data.items as FeedItem[]);
      } else {
        setAllItems((prev) => [...prev, ...data.items as FeedItem[]]);
      }
    },
  });

  const mutation = trpc.reconstruction.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setRaw("");
      toast.success("Incident submitted for review");
    },
    onError: (err) => {
      toast.error(`Submission failed: ${err.message}`);
    },
  });

  function handleSubmit() {
    setParseError(null);
    setSubmitted(false);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setParseError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    mutation.mutate(parsed as Parameters<typeof mutation.mutate>[0]);
  }

  function handleToggleForm() {
    setShowForm((v) => !v);
    setSubmitted(false);
    setRaw("");
    setParseError(null);
  }

  function clearFilters() {
    setFilterSector("ALL");
    setFilterSeverity("ALL");
    setFilterActor("");
  }

  // Derive distinct sectors from loaded items
  const distinctSectors = useMemo(() => {
    const seen = new Set<string>();
    for (const item of allItems) {
      if (item.sector) seen.add(item.sector);
    }
    return Array.from(seen).sort();
  }, [allItems]);

  // Client-side filtering
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (filterSector !== "ALL" && item.sector !== filterSector) return false;
      if (filterSeverity !== "ALL" && deriveSeverity(item) !== filterSeverity) return false;
      if (filterActor) {
        const actor = deriveActorName(item).toLowerCase();
        if (!actor.includes(filterActor.toLowerCase())) return false;
      }
      return true;
    });
  }, [allItems, filterSector, filterSeverity, filterActor]);

  const hasActiveFilters = filterSector !== "ALL" || filterSeverity !== "ALL" || filterActor !== "";
  const mostRecent = allItems[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-muted/40 px-6 py-6">
        <div className="max-w-3xl mx-auto flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Incident Feed</h1>
            {allItems.length > 0 && mostRecent && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {allItems.length} incident{allItems.length !== 1 ? "s" : ""} tracked
                {" · "}Latest:{" "}
                {new Date(mostRecent.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleToggleForm}>
            {showForm ? "Cancel" : "Add Incident"}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {showForm && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              {submitted ? (
                <p className="text-sm text-muted-foreground">
                  Submitted for review — approve via the admin flow to publish to feed.
                </p>
              ) : (
                <>
                  <Textarea
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    rows={12}
                    className="font-mono text-xs"
                    placeholder="Paste ReconstructionInput JSON..."
                  />
                  {parseError && <p className="text-sm text-destructive">{parseError}</p>}
                  {mutation.error && (
                    <p className="text-sm text-destructive">{mutation.error.message}</p>
                  )}
                  <Button onClick={handleSubmit} disabled={mutation.isPending}>
                    {mutation.isPending ? "Submitting…" : "Submit for Review"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filter bar */}
        {allItems.length > 0 && (
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <Select value={filterSector} onValueChange={setFilterSector}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All sectors</SelectItem>
                  {distinctSectors.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All severities</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <Input
                className="h-9 text-sm"
                placeholder="Filter by actor…"
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                Clear filters
              </Button>
            )}
          </div>
        )}

        {query.error && (
          <p className="text-sm text-destructive">Error: {query.error.message}</p>
        )}

        {query.isLoading && (
          <p className="text-sm text-muted-foreground">Loading incidents…</p>
        )}

        {allItems.length === 0 && !query.isLoading && !showForm && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <Newspaper className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="text-lg font-medium">No incidents yet</p>
            <p className="text-sm text-muted-foreground">
              Incidents appear here after they are submitted and approved through the admin flow.
            </p>
            <Button variant="outline" onClick={handleToggleForm}>
              Add Incident
            </Button>
          </div>
        )}

        {filteredItems.length === 0 && allItems.length > 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No incidents match the current filters.</p>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2">
              Clear filters
            </Button>
          </div>
        )}

        {filteredItems.length > 0 && (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <IncidentFeedCard
                key={item.id}
                id={item.id}
                incidentName={item.incident_name}
                incidentDate={item.incident_date ?? null}
                sector={item.sector ?? null}
                result={item.result_json as Parameters<typeof IncidentFeedCard>[0]["result"]}
                onClick={onSelectIncident}
              />
            ))}
            {query.data?.nextCursor != null && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={query.isFetching}
                  onClick={() => setCursor(query.data.nextCursor ?? undefined)}
                >
                  {query.isFetching ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
