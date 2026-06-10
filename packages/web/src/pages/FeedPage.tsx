import { useState } from "react";
import { trpc } from "@/lib/trpc.js";
import { IncidentFeedCard } from "@/components/IncidentFeedCard.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Textarea } from "@/components/ui/textarea.js";

interface Props {
  onSelectIncident: (id: number) => void;
}

export function FeedPage({ onSelectIncident }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [raw, setRaw] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [allItems, setAllItems] = useState<NonNullable<ReturnType<typeof trpc.reconstruction.list.useQuery>["data"]>["items"]>([]);

  const query = trpc.reconstruction.list.useQuery({ cursor }, {
    onSuccess: (data) => {
      if (cursor === undefined) {
        setAllItems(data.items);
      } else {
        setAllItems((prev) => [...prev, ...data.items]);
      }
    },
  });

  const mutation = trpc.reconstruction.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setRaw("");
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

        {query.error && (
          <p className="text-sm text-destructive">Error: {query.error.message}</p>
        )}

        {query.isLoading && (
          <p className="text-sm text-muted-foreground">Loading incidents…</p>
        )}

        {allItems.length === 0 && !query.isLoading && !showForm && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-sm">No incidents reconstructed yet.</p>
              <p className="text-xs mt-1">Use "Add Incident" to get started.</p>
            </CardContent>
          </Card>
        )}

        {allItems.length > 0 && (
          <div className="space-y-4">
            {allItems.map((item) => (
              <IncidentFeedCard
                key={item.id}
                id={item.id}
                incidentName={item.incident_name}
                incidentDate={item.incident_date ?? null}
                sector={item.sector ?? null}
                result={item.result_json}
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
