"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { useTimeline } from "../../store";
import { useTasks } from "../../storeTasks";
import { extractTasksFromDiary } from "../../utils/extractTasksFromDiary";


interface DiaryEntry {
  id: string;
  timestamp: string;
  content: string;
}

interface DearDiaryModalProps {
  isVisible: boolean;
  onClose: () => void;
  initialEntryId?: string;
}

const DearDiaryModal: React.FC<DearDiaryModalProps> = ({
  isVisible,
  onClose,
  initialEntryId,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef(""); // Use ref instead of state to avoid re-renders
  const [diaryNotes, setDiaryNotes] = useState<DiaryEntry[]>([]);
  const [editingNote, setEditingNote] = useState<DiaryEntry | null>(null);
  const [showEntries, setShowEntries] = useState(false);
  const [totalEntries, setTotalEntries] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Metrics state
  const [metrics, setMetrics] = useState({
    lines: 0,
    words: 0,
    chars: 0,
    cursor: { line: 1, col: 1 },
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateMetrics = () => {
    const text = contentRef.current;
    const lines = text.split("\n").length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;

    // Get cursor position
    const textarea = textareaRef.current;
    let cursorLine = 1;
    let cursorCol = 1;
    if (textarea) {
      const pos = textarea.selectionStart;
      const textBeforeCursor = text.substring(0, pos);
      cursorLine = textBeforeCursor.split("\n").length;
      const lastNewline = textBeforeCursor.lastIndexOf("\n");
      cursorCol = pos - lastNewline;
    }

    setMetrics({ lines, words, chars, cursor: { line: cursorLine, col: cursorCol } });
  };

  // Load notes from backend whenever modal opens
  useEffect(() => {
    if (!isVisible) return;

    const fetchNotes = async () => {
      try {
        const res = await fetch("/api/dd?limit=50&offset=0");
        const { entries, total, hasMore: more } = await res.json();
        setDiaryNotes(entries);
        setTotalEntries(total);
        setHasMore(more);

        if (initialEntryId) {
          const note = entries.find((n: DiaryEntry) => n.id === initialEntryId);
          if (note) {
            setEditingNote(note);
            contentRef.current = note.content;
            if (textareaRef.current) textareaRef.current.value = note.content;
          }
        } else if (entries.length > 0) {
          // Default: open the latest (most recent) entry
          const latest = entries[0];
          setEditingNote(latest);
          contentRef.current = latest.content;
          if (textareaRef.current) textareaRef.current.value = latest.content;
        }

        // Sync with timeline store (only loaded entries)
        const upsert = useTimeline.getState().upsert;
        entries.forEach((note: DiaryEntry) => {
          upsert({
            id: `dd-${note.id}`,
            title: "📔",
            start: new Date(note.id),
            status: "diary",
            notes: note.content,
          });
        });
      } catch (err) {
        console.error("Failed to load diary notes", err);
      }
    };

    fetchNotes();
    textareaRef.current?.focus();
    if (!editingNote) {
      contentRef.current = "";
      if (textareaRef.current) textareaRef.current.value = "";
    }
  }, [isVisible]);

  // Load more entries
  const loadMoreEntries = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/dd?limit=50&offset=${diaryNotes.length}`);
      const { entries, hasMore: more } = await res.json();
      setDiaryNotes(prev => [...prev, ...entries]);
      setHasMore(more);
    } catch (err) {
      console.error("Failed to load more entries", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // DEBUG: Log all key events with modifiers
      if (event.metaKey || event.ctrlKey) {
        console.log('[DD KeyDown]', {
          key: event.key,
          keyCode: event.keyCode,
          code: event.code,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
        });
      }

      if (event.key === "Escape") {
        onClose();
      }
      // Cmd+E or Ctrl+E to toggle entries sidebar
      if ((event.metaKey || event.ctrlKey) && event.key === "e") {
        event.preventDefault();
        setShowEntries((prev) => !prev);
      }
      // Cmd+Return for new entry
      if ((event.metaKey || event.ctrlKey) && (event.key === "Enter" || event.code === "Enter" || event.keyCode === 13)) {
        console.log('[DD] Cmd+Enter detected! Creating new entry...');
        event.preventDefault();
        event.stopPropagation();
        handleCreateNewEntry();
      }
      // Cmd+D or Ctrl+D to delete current entry
      if ((event.metaKey || event.ctrlKey) && event.key === "d") {
        event.preventDefault();
        if (editingNote) {
          handleDeleteNote(editingNote.id);
        }
      }
      // Up/Down to navigate entries when sidebar is open
      if (showEntries && diaryNotes.length > 0) {
        if (event.key === "ArrowUp" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          const currentIndex = editingNote
            ? diaryNotes.findIndex(n => n.id === editingNote.id)
            : -1;
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : diaryNotes.length - 1;
          handlePreviousEntryClick(diaryNotes[prevIndex]);
        }
        if (event.key === "ArrowDown" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          const currentIndex = editingNote
            ? diaryNotes.findIndex(n => n.id === editingNote.id)
            : -1;
          const nextIndex = currentIndex < diaryNotes.length - 1 ? currentIndex + 1 : 0;
          handlePreviousEntryClick(diaryNotes[nextIndex]);
        }
      }
    };

    if (isVisible) {
      window.addEventListener("keydown", handleKeyDown, true); // capture phase
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isVisible, onClose, showEntries, diaryNotes, editingNote]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  const reloadNotes = async () => {
    try {
      const res = await fetch("/api/dd?limit=50&offset=0");
      const { entries, total, hasMore: more } = await res.json();
      setDiaryNotes(entries);
      setTotalEntries(total);
      setHasMore(more);

      // Sync with timeline store
      const upsert = useTimeline.getState().upsert;
      entries.forEach((note: DiaryEntry) => {
        upsert({
          id: `dd-${note.id}`,
          title: "📔",
          start: new Date(note.id),
          status: "diary",
          notes: note.content,
        });
      });

      // Task extraction (only for brand-new entries)
      if (!editingNote) {
        const diaryDate = new Date();
        const content = contentRef.current;
        const newTasks = await extractTasksFromDiary(content, diaryDate);
        if (newTasks.length) {
          useTasks.getState().bulkAdd(newTasks);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreviousEntryClick = (note: DiaryEntry) => {
    setEditingNote(note);
    contentRef.current = note.content;
    if (textareaRef.current) textareaRef.current.value = note.content;
    textareaRef.current?.focus();
  };

  const handleStartNewEntry = () => {
    setEditingNote(null);
    contentRef.current = "";
    if (textareaRef.current) textareaRef.current.value = "";
    textareaRef.current?.focus();
    setAutoSaveStatus("idle");
  };

  // Create a new entry in backend and switch to it
  const handleCreateNewEntry = async () => {
    try {
      // Create new entry with empty content (or a space to ensure it saves)
      const res = await fetch("/api/dd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: " " }),
      });
      const newEntry = await res.json();

      // Reload notes to get updated list
      await reloadNotes();

      // Switch to the new entry
      setEditingNote({ id: newEntry.id, timestamp: newEntry.timestamp, content: "" });
      contentRef.current = "";
      if (textareaRef.current) textareaRef.current.value = "";
      textareaRef.current?.focus();
      setAutoSaveStatus("idle");

      console.log('[DD] New entry created:', newEntry.id);
    } catch (err) {
      console.error("Failed to create new entry", err);
    }
  };

  // Auto-save function
  const triggerAutoSave = () => {
    // Clear any pending save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    const content = contentRef.current.trim();
    if (!content) {
      setAutoSaveStatus("idle");
      return;
    }

    // Debounce: save after 1 second of no typing
    autoSaveTimeoutRef.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      try {
        if (editingNote) {
          await fetch(`/api/dd/${editingNote.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
        } else {
          const res = await fetch("/api/dd", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
          const newEntry = await res.json();
          // Set as editing note so subsequent saves update instead of create
          setEditingNote({ id: newEntry.id, timestamp: newEntry.timestamp, content });
        }
        await reloadNotes();
        setAutoSaveStatus("saved");
        // Reset to idle after showing "saved"
        setTimeout(() => setAutoSaveStatus("idle"), 1500);
      } catch (err) {
        console.error("Auto-save failed", err);
        setAutoSaveStatus("idle");
      }
    }, 1000);
  };

  const handleDeleteNote = async (id: string) => {
    try {
      // Find current index before deleting
      const currentIndex = diaryNotes.findIndex(n => n.id === id);

      await fetch(`/api/dd/${id}`, { method: "DELETE" });

      // Fetch updated notes with pagination
      const res = await fetch("/api/dd?limit=50&offset=0");
      const { entries: updatedNotes, total, hasMore: more } = await res.json();
      setDiaryNotes(updatedNotes);
      setTotalEntries(total);
      setHasMore(more);

      // Select next most recent entry
      if (updatedNotes.length > 0) {
        // Try to select the entry at the same index, or the last one if we deleted the last
        const nextIndex = Math.min(currentIndex, updatedNotes.length - 1);
        const nextNote = updatedNotes[nextIndex];
        setEditingNote(nextNote);
        contentRef.current = nextNote.content;
        if (textareaRef.current) textareaRef.current.value = nextNote.content;
      } else {
        // No entries left
        handleStartNewEntry();
      }

      textareaRef.current?.focus();
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toISOString().replace("T", " ").replace("Z", "");
  };

  const formatSidebarDate = (ts: string) => {
    const d = new Date(ts);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = days[d.getDay()];
    const month = months[d.getMonth()];
    const date = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}, ${month} ${date} ${year}`;
  };

  const formatSidebarTime = (ts: string) => {
    const d = new Date(ts);
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const secs = String(d.getSeconds()).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/95 p-4 sm:p-8 md:p-12"
      data-modal-open="true"
      onKeyDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      {/* Main terminal window */}
      <div
        className="w-full max-w-3xl h-full max-h-[80vh] flex flex-col bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar with dots and prompt */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="ml-2 text-slate-500 font-mono text-sm">dd</span>
            <span className="text-slate-700 font-mono text-sm">/</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-green-400 font-mono text-sm leading-none">&gt;</span>
              <span className="text-slate-400 font-mono text-sm leading-none">
                {editingNote ? formatTimestamp(editingNote.id) : (diaryNotes.length === 0 ? "no files" : "new")}
              </span>
            </span>
          </div>
          {/* Toggle entries */}
          <button
            onClick={() => setShowEntries(!showEntries)}
            className={cn(
              "group relative font-mono text-xs px-2 py-1 rounded",
              showEntries ? "text-green-400" : "text-slate-600 hover:text-slate-400"
            )}
          >
            {totalEntries}
            <span
              className="absolute right-0 top-full mt-2 px-2.5 py-1.5 text-[11px] text-slate-400 bg-slate-800 border border-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
              style={{ transitionDelay: "600ms" }}
            >
              toggle entries · <span className="text-slate-500">cmd + E</span>
            </span>
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 flex min-h-0">
          {/* Entries sidebar - hidden by default */}
          {showEntries && (
            <div className="flex flex-col w-48 border-r border-slate-800">
              <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
                {diaryNotes.length === 0 ? (
                  <div className="px-4 py-6 text-slate-600 font-mono text-xs">
                    no files
                  </div>
                ) : (
                  <>
                    {diaryNotes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => handlePreviousEntryClick(note)}
                        className={cn(
                          "px-4 py-2 font-mono cursor-pointer",
                          editingNote?.id === note.id
                            ? "bg-slate-800"
                            : "hover:bg-slate-800/50"
                        )}
                      >
                        <div className={cn(
                          "text-xs",
                          editingNote?.id === note.id ? "text-green-400" : "text-slate-400"
                        )}>
                          {formatSidebarDate(note.id)}
                        </div>
                        <div className={cn(
                          "text-[10px]",
                          editingNote?.id === note.id ? "text-green-500/70" : "text-slate-600"
                        )}>
                          {formatSidebarTime(note.id)}
                        </div>
                      </div>
                    ))}
                    {hasMore && (
                      <button
                        onClick={loadMoreEntries}
                        disabled={isLoadingMore}
                        className="w-full px-4 py-3 font-mono text-xs text-slate-500 hover:text-green-400 hover:bg-slate-800/50 transition-colors border-t border-slate-800"
                      >
                        {isLoadingMore ? "loading..." : `load more (${diaryNotes.length}/${totalEntries})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Editor */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Textarea - darker background */}
            <div className="flex-1 min-h-0 bg-slate-950">
              <textarea
                ref={textareaRef}
                defaultValue=""
                onChange={(e) => {
                  contentRef.current = e.target.value;
                  updateMetrics();
                  triggerAutoSave();
                }}
                onKeyUp={updateMetrics}
                onClick={updateMetrics}
                onKeyDown={(e) => {
                  // Allow shortcuts to bubble
                  if ((e.metaKey || e.ctrlKey) && (["e", "d", "ArrowUp", "ArrowDown"].includes(e.key) || e.key === "Enter" || e.keyCode === 13)) {
                    return;
                  }
                  e.stopPropagation();
                }}
                placeholder={diaryNotes.length === 0 && !editingNote ? "cmd+enter to create new file..." : "start typing..."}
                className="w-full h-full px-4 py-4 bg-transparent text-slate-200 placeholder:text-slate-600 focus:outline-none resize-none text-[15px] scrollbar-hide"
                style={{
                  fontFamily: "'Fira Code', 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace",
                  lineHeight: "1.9",
                  caretColor: "#4ade80",
                  fontFeatureSettings: "'liga' 1, 'calt' 1",
                }}
                spellCheck={false}
              />
            </div>

            {/* Cool footer with metrics */}
            <div className="h-10 flex items-center justify-between px-4 border-t border-slate-800 bg-slate-900/50">
              {/* Left: cursor position & metrics */}
              <div className="flex items-center gap-4 font-mono text-[11px]">
                <span className="text-green-400">
                  Ln {metrics.cursor.line}, Col {metrics.cursor.col}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-500">
                  {metrics.lines} {metrics.lines === 1 ? "line" : "lines"}
                </span>
                <span className="text-slate-500">
                  {metrics.words} {metrics.words === 1 ? "word" : "words"}
                </span>
                <span className="text-slate-500">
                  {metrics.chars} {metrics.chars === 1 ? "char" : "chars"}
                </span>
              </div>

              {/* Right: auto-save status */}
              <span className="font-mono text-[11px]">
                {autoSaveStatus === "saving" && <span className="text-yellow-500">saving...</span>}
                {autoSaveStatus === "saved" && <span className="text-green-500">saved</span>}
                {autoSaveStatus === "idle" && <span className="text-slate-600">auto-save</span>}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DearDiaryModal;
