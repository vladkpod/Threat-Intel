import { useState } from "react";
import { FeedPage } from "@/pages/FeedPage.js";
import { SectorPage } from "@/pages/SectorPage.js";
import { DetailPage } from "@/pages/DetailPage.js";
import { cn } from "@/lib/utils.js";

type Page = "feed" | "sector" | "detail";

const NAV: { id: "feed" | "sector"; label: string }[] = [
  { id: "feed", label: "Incident Feed" },
  { id: "sector", label: "Sector View" },
];

export function App() {
  const [page, setPage] = useState<Page>("feed");
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);

  function handleSelectIncident(id: number) {
    setSelectedIncidentId(id);
    setPage("detail");
  }

  function handleBack() {
    setPage("feed");
    setSelectedIncidentId(null);
  }

  return (
    <div>
      {page !== "detail" && (
        <nav className="border-b bg-muted/40">
          <div className="max-w-5xl mx-auto px-6 flex gap-1 py-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={cn(
                  "px-3 py-2 text-sm rounded-sm transition-colors",
                  page === n.id
                    ? "bg-background font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60",
                )}
              >
                {n.label}
              </button>
            ))}
          </div>
        </nav>
      )}
      {page === "feed" && <FeedPage onSelectIncident={handleSelectIncident} />}
      {page === "sector" && <SectorPage />}
      {page === "detail" && selectedIncidentId !== null && (
        <DetailPage incidentId={selectedIncidentId} onBack={handleBack} />
      )}
    </div>
  );
}
