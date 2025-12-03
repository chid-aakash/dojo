import GlobalSearchInput from "./components/search/GlobalSearchInput";
import { useState, useEffect, lazy, Suspense } from "react";
import DearDiaryModal from "./components/diary/DearDiaryModal";
import RetroGrid from "@/components/magicui/retro-grid";
import { useTimeline } from "./store";
import HelpModal from "./components/HelpModal";

// Lazy load the timeline component
const DojoTimeline = lazy(() => import("./components/DojoTimeline"));

// Preload vis-timeline as early as possible
if (typeof window !== 'undefined') {
  // Preload both the component and the library
  import("./components/DojoTimeline");
  import("vis-timeline/standalone");
}

export default function App() {
  const [isDdModalVisible, setIsDdModalVisible] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleSearch = (searchTerm: string) => {
    console.log("Search submitted:", searchTerm);
    // TODO: Implement actual search/plan adding logic here
    // For example, this could involve:
    // - Sending the searchTerm to an AI service to parse it into a plan/task
    // - Updating application state with the new plan/task
    // - Re-rendering the timeline or task list
  };

  const handleDdCommand = () => {
    console.log("'dd' command received. Opening Dear Diary modal...");
    setSelectedEntryId(null);
    setIsDdModalVisible(true);
  };

  const handleCloseDdModal = () => {
    setIsDdModalVisible(false);
    setSelectedEntryId(null);
  };

  // Fetch diary entries once on mount to populate timeline
  useEffect(() => {
    let abortController = new AbortController();
    let isMounted = true;

    const fetchInitialDiary = async () => {
      try {
        const res = await fetch("/api/dd", { signal: abortController.signal });

        // Check if component is still mounted and response is ok
        if (!isMounted || !res.ok) {
          return;
        }

        const json = await res.json();
        const data: { id: string; timestamp: string; content: string }[] =
          json.entries || json;

        if (!isMounted) return;

        console.log('[App] Fetched diary entries:', data.length, data.map(n => n.id));
        const upsert = useTimeline.getState().upsert;
        data.forEach((note) => {
          console.log('[App] Upserting diary:', note.id);
          upsert({
            id: `dd-${note.id}`,
            title: "📔",
            start: new Date(note.id),
            status: "diary",
            notes: note.content,
          });
        });
        console.log('[App] Store items after upsert:', useTimeline.getState().items.length);
      } catch {
        // Silently handle errors - backend might not be running
      }
    };

    fetchInitialDiary();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    const handler = () => setShowHelp(true);
    window.addEventListener("dojo:help", handler);
    return () => window.removeEventListener("dojo:help", handler);
  }, []);

  const HELP_LINES = [
    "COMMANDS",
    "  dd              – open Dear Diary modal",
    "  help            – display this command list",
    "",
    "DATE NAVIGATION (press Enter, type date, press Enter)",
    "  2025            – go to year (Level 1: Years)",
    "  feb2025         – go to month (Level 2: Months)",
    "  022025          – go to month (MMYYYY)",
    "  02/2025         – go to month (MM/YYYY)",
    "  20feb2025       – go to day (Level 3: Days)",
    "  02/02/2025      – go to day (DD/MM/YYYY)",
    "  20feb25 5pm     – go to time (Level 4: Hours)",
    "  20feb25 17:30   – go to time (Level 5: Minutes)",
    "",
    "KEYBOARD SHORTCUTS",
    "  1-5             – zoom to level (Years/Months/Days/Hours/Minutes)",
    "  n               – go to now",
    "  r               – refresh diary entries from API",
    "  +/-             – zoom in/out within level",
    "  l               – lock zoom to current level",
    "  Arrow keys      – pan timeline (left/right) or zoom (up/down)",
  ];

  return (
    <div className="relative flex h-screen w-screen flex-col items-stretch justify-start overflow-hidden bg-background">
      <RetroGrid className="absolute inset-0 z-0" />
      <div className="relative z-10 flex flex-col h-full w-full p-2 space-y-1">
        <header className="bg-transparent flex-shrink-0 px-2 py-1">
          <h1 className="text-2xl font-bold font-mono text-emerald-500">dojo</h1>
        </header>
        <main className="flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow w-full h-full">
            <Suspense fallback={
              <div className="flex-1 bg-gray-900 rounded-lg shadow-xl relative overflow-hidden">
                <div className="h-full flex items-center justify-center">
                  <div className="text-gray-400 animate-pulse">Preparing timeline...</div>
                </div>
              </div>
            }>
              <DojoTimeline
                onOpenDiary={(id) => {
                  setSelectedEntryId(id);
                  setIsDdModalVisible(true);
                }}
                disableShortcuts={isDdModalVisible || showHelp}
              />
            </Suspense>
          </div>
        </main>
        <div className="flex-shrink-0 w-full px-2 py-1">
          <GlobalSearchInput
            onSearchSubmit={handleSearch}
            onDdCommand={handleDdCommand}
          />
        </div>
        {isDdModalVisible && (
          <DearDiaryModal
            isVisible={isDdModalVisible}
            onClose={handleCloseDdModal}
            initialEntryId={selectedEntryId || undefined}
          />
        )}
        {showHelp && (
          <HelpModal
            isOpen={showHelp}
            onClose={() => setShowHelp(false)}
            lines={HELP_LINES}
          />
        )}
      </div>
    </div>
  );
}
