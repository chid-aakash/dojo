import DojoTimeline from './components/DojoTimeline';
import GlobalSearchInput from './components/search/GlobalSearchInput';
import React, { useState } from 'react';
import DearDiaryModal from './components/diary/DearDiaryModal';
import RetroGrid from "@/components/magicui/retro-grid";

export default function App() {
  const [isDdModalVisible, setIsDdModalVisible] = useState(false);

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
    setIsDdModalVisible(true);
  };

  const handleCloseDdModal = () => {
    setIsDdModalVisible(false);
  };

  return (
    <div className="relative flex h-screen w-screen flex-col items-stretch justify-start overflow-hidden bg-background">
      <RetroGrid className="absolute inset-0 z-0" />
      <div className="relative z-10 flex flex-col h-full w-full p-2 space-y-1">
        <header className="bg-transparent flex-shrink-0 px-2 py-1">
          <h1 className="text-2xl font-bold">Dojo</h1>
        </header>
        <main className="flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow w-full h-full">
            <DojoTimeline />
          </div>
        </main>
        <div className="flex-shrink-0 w-full px-2 py-1">
          <GlobalSearchInput onSearchSubmit={handleSearch} onDdCommand={handleDdCommand} />
        </div>
        {isDdModalVisible && <DearDiaryModal isVisible={isDdModalVisible} onClose={handleCloseDdModal} />}
      </div>
    </div>
  );
}
