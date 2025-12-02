"use client";

import React, { useState, useEffect, useRef } from "react";
// import { ShineBorder } from '../ui/ShineBorder'; // Removed ShineBorder
import { Terminal, TypingAnimation } from "../ui/Terminal"; // Added Terminal and TypingAnimation
import { cn } from "../../lib/utils";
import { parseDateInput } from "../../utils/parseDateInput";

interface GlobalSearchInputProps {
  onSearchSubmit: (searchTerm: string) => void;
  onDdCommand: () => void; // New prop for 'dd' command
  // Add any other props you might need
}

const GlobalSearchInput: React.FC<GlobalSearchInputProps> = ({
  onSearchSubmit,
  onDdCommand,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Global event listener for 'Enter' to show the search bar
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Skip if any modal is open (check for modal overlay)
      if (document.querySelector('[data-modal-open="true"]')) {
        console.log('[GlobalSearch] keyDown blocked by data-modal-open');
        return;
      }

      const activeElement = document.activeElement;
      // Skip if typing in any input/textarea
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).isContentEditable)
      ) {
        console.log('[GlobalSearch] keyDown blocked by input/textarea focus');
        return;
      }

      if (event.key === "Enter" && !isVisible) {
        console.log('[GlobalSearch] PROCESSING Enter - opening search');
        event.preventDefault();
        setIsVisible(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isVisible]);

  // Focus input when search bar becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  // Close on Escape even when input not focused
  useEffect(() => {
    if (!isVisible) return;
    const escListener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsVisible(false);
        setSearchTerm("");
      }
    };
    window.addEventListener("keydown", escListener);
    return () => window.removeEventListener("keydown", escListener);
  }, [isVisible]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const trimmedSearchTerm = searchTerm.trim();
      const lower = trimmedSearchTerm.toLowerCase();
      if (lower === "dd") {
        onDdCommand();
        setIsVisible(false);
        setSearchTerm("");
        return;
      } else if (lower === "simulate dd") {
        await fetch("/api/dd/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        onSearchSubmit("reload");
        setIsVisible(false);
        setSearchTerm("");
        return;
      } else if (lower === "clear sim") {
        await fetch("/api/dd/simulate", { method: "DELETE" });
        onSearchSubmit("reload");
        setIsVisible(false);
        setSearchTerm("");
        return;
      } else if (lower === "help") {
        window.dispatchEvent(new CustomEvent("dojo:help"));
        setIsVisible(false);
        setSearchTerm("");
        return;
      }

      // Try to parse as date for quick navigation
      const dateResult = parseDateInput(trimmedSearchTerm);
      if (dateResult) {
        window.dispatchEvent(
          new CustomEvent("dojo:goto", {
            detail: { date: dateResult.date, level: dateResult.level },
          })
        );
        setIsVisible(false);
        setSearchTerm("");
        return;
      }

      if (trimmedSearchTerm) {
        onSearchSubmit(trimmedSearchTerm);
        setIsVisible(false);
        setSearchTerm("");
        return;
      }
      // default: hide
      setIsVisible(false);
      setSearchTerm("");
    } else if (event.key === "Escape") {
      setIsVisible(false);
      setSearchTerm(""); // Clear on escape
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-none" data-modal-open="true">
      <Terminal
        className={cn(
          "w-full max-w-2xl mx-auto shadow-2xl !bg-slate-900/95 border-slate-700 !max-h-[120px] pointer-events-auto" // Custom terminal styling & reduced height
          // Add any other specific classes for the terminal container
        )}
      >
        <div className="flex items-center px-1 py-1">
          {" "}
          {/* Ensure this content fits the new height well */}
          <TypingAnimation
            duration={30}
            className="text-green-400 !text-base sm:!text-lg mr-2"
          >
            {"> "}
          </TypingAnimation>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="dd, help, or date (feb2025, 20feb25 5pm)..." // Date nav hint
            className={cn(
              "flex-grow bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none caret-green-400",
              "font-mono text-base sm:text-lg", // Monospaced font, coder-like
              // Remove default input styling that might interfere
              "border-none p-0 m-0 appearance-none focus:ring-0"
            )}
          />
        </div>
      </Terminal>
    </div>
  );
};

export default GlobalSearchInput;
