import { useState } from "react";
import { FeedPage } from "@/pages/FeedPage.js";
import { SectorPage } from "@/pages/SectorPage.js";
import { DetailPage } from "@/pages/DetailPage.js";
import { AssessmentPage } from "@/pages/AssessmentPage.js";
import { AdminPage } from "@/pages/AdminPage.js";
import { cn } from "@/lib/utils.js";

type Page = "feed" | "sector" | "detail" | "assessment" | "admin";

const NAV_ITEMS: { id: "feed" | "sector" | "admin"; label: string; adminOnly?: boolean }[] = [
  { id: "feed", label: "Incident Feed" },
  { id: "sector", label: "Sector View" },
  { id: "admin", label: "Admin", adminOnly: true },
];

const ADMIN_KEY = import.meta.env["VITE_ADMIN_API_KEY"] as string | undefined;

export function App() {
  const [page, setPage] = useState<Page>("feed");
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);

  function handleSelectIncident(id: number) {
    setSelectedIncidentId(id);
    setPage("detail");
  }

  function handleBack() {
    setPage("feed");
    setSelectedIncidentId(null);
  }

  function handleOpenAssessment(assessmentId: number) {
    setSelectedAssessmentId(assessmentId);
    setPage("assessment");
  }

  function handleBackFromAssessment() {
    if (selectedIncidentId !== null) {
      setPage("detail");
    } else {
      setPage("feed");
    }
    setSelectedAssessmentId(null);
  }

  const visibleNav = NAV_ITEMS.filter((n) => !n.adminOnly || !!ADMIN_KEY);

  return (
    <div>
      {page !== "detail" && page !== "assessment" && (
        <nav className="bg-gray-900 text-white">
          <div className="max-w-5xl mx-auto px-6 flex items-center gap-6 h-14">
            <span className="font-bold text-base tracking-tight text-white shrink-0">
              Threat Intel
            </span>
            <div className="flex gap-2">
              {visibleNav.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setPage(n.id)}
                  className={cn(
                    "px-4 py-1.5 text-sm rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900",
                    page === n.id
                      ? "bg-white text-gray-900 font-semibold"
                      : "text-gray-300 hover:text-white hover:bg-white/10",
                  )}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}
      {page === "feed" && <FeedPage onSelectIncident={handleSelectIncident} />}
      {page === "sector" && <SectorPage />}
      {page === "admin" && <AdminPage />}
      {page === "detail" && selectedIncidentId !== null && (
        <DetailPage
          incidentId={selectedIncidentId}
          onBack={handleBack}
          onOpenAssessment={handleOpenAssessment}
        />
      )}
      {page === "assessment" && selectedAssessmentId !== null && (
        <AssessmentPage
          assessmentId={selectedAssessmentId}
          onBack={handleBackFromAssessment}
        />
      )}
    </div>
  );
}
