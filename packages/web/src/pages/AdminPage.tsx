import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import { ClipboardList } from "lucide-react";

const ADMIN_KEY = import.meta.env["VITE_ADMIN_API_KEY"] as string | undefined;
const API_BASE = import.meta.env["VITE_API_URL"] as string | undefined ?? "http://localhost:3001";

export function AdminPage() {
  const query = trpc.review.list.useQuery();
  const [actioning, setActioning] = useState<number | null>(null);

  async function handleAction(id: number, action: "approve" | "reject") {
    setActioning(id);
    try {
      const item = items.find((i) => i.id === id);
      let body: Record<string, unknown> = { reviewer: "admin" };
      if (action === "approve" && item?.candidate_text) {
        try {
          body = { ...body, reconstruction_input: JSON.parse(item.candidate_text) as unknown };
        } catch {
          toast.error("Cannot parse reconstruction input for this item.");
          setActioning(null);
          return;
        }
      }
      const res = await fetch(`${API_BASE}/admin/review/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-api-key": ADMIN_KEY ?? "",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(`Error: ${data.error ?? res.statusText}`);
      } else {
        toast.success(`Item ${action === "approve" ? "approved" : "rejected"} successfully.`);
        void query.refetch();
      }
    } catch (err) {
      toast.error(`Network error: ${String(err)}`);
    } finally {
      setActioning(null);
    }
  }

  const items = query.data ?? [];

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Admin — Review Queue</h1>

        {query.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {!query.isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <ClipboardList className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="text-lg font-medium">No pending items</p>
            <p className="text-sm text-muted-foreground">
              All submitted incidents have been reviewed.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.candidate_title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {item.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {item.tier_ceiling}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => void handleAction(item.id, "reject")}
                        disabled={actioning === item.id}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void handleAction(item.id, "approve")}
                        disabled={actioning === item.id}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
