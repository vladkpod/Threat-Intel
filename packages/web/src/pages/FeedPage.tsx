import { useState } from "react";
import { trpc } from "@/lib/trpc.js";
import { IncidentFeedCard } from "@/components/IncidentFeedCard.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Textarea } from "@/components/ui/textarea.js";
import type { ReconstructionOutput } from "../../../engine/src/schema.js";

interface Props {
  onSelectIncident: (id: number) => void;
}

export function FeedPage({ onSelectIncident }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [raw, setRaw] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const query = trpc.reconstruction.list.useQuery();
  const mutation = trpc.reconstruction.run.useMutation({
    onSuccess: () => {
      void query.refetch();
      setShowForm(false);
      setRaw("");
    },
  });

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Incident Feed</h1>
          <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Add Incident"}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {showForm && (
          <Card>
            <CardContent className="pt-6 space-y-3">
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
                {mutation.isPending ? "Reconstructing…" : "Reconstruct Incident"}
              </Button>
            </CardContent>
          </Card>
        )}

        {query.error && (
          <p className="text-sm text-destructive">Error: {query.error.message}</p>
        )}

        {query.isLoading && (
          <p className="text-sm text-muted-foreground">Loading incidents…</p>
        )}

        {query.data && query.data.length === 0 && !showForm && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-sm">No incidents reconstructed yet.</p>
              <p className="text-xs mt-1">Use "Add Incident" to get started.</p>
            </CardContent>
          </Card>
        )}

        {query.data && query.data.length > 0 && (
          <div className="space-y-4">
            {query.data.map((item) => (
              <IncidentFeedCard
                key={item.id}
                id={item.id}
                incidentName={item.incident_name}
                createdAt={item.created_at}
                result={item.result_json as unknown as ReconstructionOutput}
                onClick={onSelectIncident}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
