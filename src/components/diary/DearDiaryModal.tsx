'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '../ui/Terminal';
import { cn } from '../../lib/utils';

interface DiaryEntry {
  id: string; // ISO string timestamp or a UUID
  timestamp: string; // User-friendly display timestamp
  content: string;
}

interface DearDiaryModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const DearDiaryModal: React.FC<DearDiaryModalProps> = ({ isVisible, onClose }) => {
  const newNoteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [diaryNotes, setDiaryNotes] = useState<DiaryEntry[]>([]);
  const [currentContent, setCurrentContent] = useState('');
  const [editingNote, setEditingNote] = useState<DiaryEntry | null>(null); // Stores the note being viewed/edited

  useEffect(() => {
    if (isVisible) {
      console.log("DearDiaryModal: Simulating attempt to load notes from '/Users/aakashchid/dojodata/'");
      newNoteTextareaRef.current?.focus();
      // If not editing, ensure currentContent is clear and focus is on textarea
      if (!editingNote) {
        setCurrentContent(''); 
      }
    } else {
      // Reset editing state when modal is closed
      setEditingNote(null);
      setCurrentContent('');
    }
  }, [isVisible]); // Removed editingNote from dependencies to avoid clearing content on edit

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, onClose]);

  if (!isVisible) {
    return null;
  }

  const handleSaveNewNote = () => {
    if (!currentContent.trim()) {
      return;
    }
    const newTimestamp = new Date();
    // If editingNote is set, we could choose to update it here instead of creating a new one.
    // For now, saving always creates a new entry as per original logic.
    // To update, you'd find the note by editingNote.id and replace it.
    const newNote: DiaryEntry = {
      id: newTimestamp.toISOString(), // Always new ID for new entry
      timestamp: newTimestamp.toLocaleString(),
      content: currentContent.trim(),
    };
    
    const filePath = `/Users/aakashchid/dojodata/${newTimestamp.toISOString().replace(/:/g, '-')}.json`;
    console.log(`DearDiaryModal: Simulating save to '${filePath}'`);
    console.log("New note content:", JSON.stringify(newNote, null, 2));

    setDiaryNotes(prevNotes => [newNote, ...prevNotes].sort((a,b) => new Date(b.id).getTime() - new Date(a.id).getTime()));
    setCurrentContent(''); 
    setEditingNote(null); // Go back to new entry mode after saving
    newNoteTextareaRef.current?.focus();
  };

  const handlePreviousEntryClick = (note: DiaryEntry) => {
    setEditingNote(note);
    setCurrentContent(note.content);
    newNoteTextareaRef.current?.focus();
  };

  const handleStartNewEntry = () => {
    setEditingNote(null);
    setCurrentContent('');
    newNoteTextareaRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-lg p-4 sm:p-6 md:p-8">
      <Terminal
        className={cn(
          "w-full h-full !max-w-none !max-h-none shadow-2xl !bg-slate-900/95 border-slate-700 flex flex-col",
        )}
      >
        <div className="flex-shrink-0 flex justify-between items-center border-b border-slate-700 p-3 sm:p-4">
          <h2 className="text-xl sm:text-2xl text-green-400 font-mono">Dear Diary</h2>
        </div>

        {/* Ensure this container takes full available height */}
        <div className="flex-grow h-full flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Panel: Previous Entries */}
          <div className="w-full md:w-1/3 lg:w-1/4 md:h-full border-b md:border-b-0 md:border-r border-slate-700 flex flex-col overflow-hidden">
            <h3 className="flex-shrink-0 text-lg text-slate-300 p-3 sm:p-4 border-b border-slate-600 font-mono">Previous Entries:</h3>
            {/* Changed overflow-y-auto to overflow-hidden */}
            <div className="flex-grow overflow-hidden p-3 sm:p-4 space-y-3">
              {diaryNotes.length === 0 && (
                <p className="text-slate-500 italic">No entries yet. Write your first one!</p>
              )}
              {diaryNotes.map((note) => (
                <div 
                  key={note.id} 
                  className={cn(
                    "p-2.5 bg-slate-800/50 rounded border border-slate-700/70 hover:border-slate-600 transition-colors cursor-pointer",
                    editingNote?.id === note.id && "ring-2 ring-green-500 border-green-500" // Highlight if being edited
                  )}
                  onClick={() => handlePreviousEntryClick(note)}
                >
                  <p className="text-xs text-slate-400 mb-1.5">{note.timestamp}</p>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap break-words line-clamp-3">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: New/Viewing Entry */}
          <div className="w-full md:w-2/3 lg:w-3/4 md:h-full flex flex-col p-3 sm:p-4 min-h-0">
            <div className="flex-shrink-0 flex justify-between items-center mb-2 sm:mb-3">
              <h3 className="text-lg text-slate-300 font-mono">
                {editingNote ? (
                  <>
                    Viewing Entry: <span className="text-xs text-slate-400">{editingNote.timestamp}</span>
                  </>
                ) : (
                  <>
                    New Entry: <span className="text-xs text-slate-400">{new Date().toLocaleString()}</span>
                  </>
                )}
              </h3>
              {editingNote && (
                <button
                  onClick={handleStartNewEntry}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors"
                >
                  Start New Entry
                </button>
              )}
            </div>
            <div className="flex-grow flex flex-col min-h-0">
              <textarea
                ref={newNoteTextareaRef}
                value={currentContent}
                onChange={(e) => setCurrentContent(e.target.value)}
                placeholder="What's on your mind, warrior?"
                className="flex-grow w-full p-2.5 bg-slate-800/70 border border-slate-600 rounded text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 caret-green-400 resize-none text-sm font-mono"
              />
              <div className="flex-shrink-0 flex justify-end mt-3 sm:mt-4">
                <button
                  onClick={handleSaveNewNote}
                  disabled={!currentContent.trim()}
                  className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded text-sm font-semibold transition-colors"
                >
                  {editingNote ? "Save Changes as New Entry" : "Save Entry"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Terminal>
    </div>
  );
};

export default DearDiaryModal; 