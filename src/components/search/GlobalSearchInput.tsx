'use client';

import React, { useState, useEffect, useRef } from 'react';
// import { ShineBorder } from '../ui/ShineBorder'; // Removed ShineBorder
import { Terminal, TypingAnimation } from '../ui/Terminal'; // Added Terminal and TypingAnimation
import { cn } from '../../lib/utils';

interface GlobalSearchInputProps {
  onSearchSubmit: (searchTerm: string) => void;
  onDdCommand: () => void; // New prop for 'dd' command
  // Add any other props you might need
}

const GlobalSearchInput: React.FC<GlobalSearchInputProps> = ({ onSearchSubmit, onDdCommand }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Global event listener for 'Enter' to show the search bar
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !isVisible && !isInputFocused()) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || (activeElement as HTMLElement).isContentEditable)) {
          return; // Don't show if already in an input field
        }
        event.preventDefault(); // Prevent default Enter behavior (e.g., submitting a form)
        setIsVisible(true);
      }
    };

    const isInputFocused = () => {
      const activeElement = document.activeElement;
      return activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isVisible]);

  // Focus input when search bar becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const trimmedSearchTerm = searchTerm.trim();
      if (trimmedSearchTerm.toLowerCase() === 'dd') {
        onDdCommand();
      } else if (trimmedSearchTerm) {
        onSearchSubmit(trimmedSearchTerm);
      }
      setSearchTerm(''); // Clear after submit
      setIsVisible(false); // Hide after submit
    } else if (event.key === 'Escape') {
      setIsVisible(false);
      setSearchTerm(''); // Clear on escape
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Terminal
        className={cn(
          "w-full max-w-2xl mx-auto shadow-2xl !bg-slate-900/80 border-slate-700 !max-h-[120px]", // Custom terminal styling & reduced height
          // Add any other specific classes for the terminal container
        )}
      >
        <div className="flex items-center px-1 py-1"> {/* Ensure this content fits the new height well */}
          <TypingAnimation duration={30} className="text-green-400 !text-base sm:!text-lg mr-2">{'> '}</TypingAnimation>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter your command..." // Changed placeholder
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