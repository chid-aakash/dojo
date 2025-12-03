"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal, TypingAnimation } from "../ui/Terminal";
import { cn } from "../../lib/utils";
import { parseDateInput } from "../../utils/parseDateInput";
import { chat, getModelName, type ChatMessage } from "../../services/ai";

interface GlobalSearchInputProps {
  onSearchSubmit: (searchTerm: string) => void;
  onDdCommand: () => void;
}

const GlobalSearchInput: React.FC<GlobalSearchInputProps> = ({
  onSearchSubmit,
  onDdCommand,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // AI Mode state
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string>("AI");
  const aiInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch model name on mount
  useEffect(() => {
    getModelName().then(setModelName);
  }, []);

  // Global event listener for 'Enter' to show the search bar
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[data-modal-open="true"]')) return;

      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (event.key === "Enter" && !isVisible) {
        event.preventDefault();
        setIsVisible(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isVisible]);

  // Focus input when search bar becomes visible
  useEffect(() => {
    if (isVisible) {
      if (isAiMode && aiInputRef.current) {
        aiInputRef.current.focus();
      } else if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isVisible, isAiMode]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Send query to AI
  const sendAiQuery = async (query: string) => {
    const userMessage: ChatMessage = { role: "user", content: query };
    setMessages(prev => [...prev, userMessage]);
    setIsAiLoading(true);
    setAiError(null);
    setStreamingContent("");

    try {
      const result = await chat(query, messages, {
        onSearchStart: (searchQuery) => {
          setStreamingContent(`🔍 Searching: "${searchQuery}"...`);
        },
        onSearchResults: (results) => {
          setMessages(prev => [...prev, {
            role: "tool",
            content: results,
            isToolResult: true,
            toolName: "web_search"
          }]);
          setStreamingContent("Analyzing results...");
        },
        onStreamChunk: (content) => {
          setStreamingContent(content);
        },
        onComplete: (response) => {
          if (response) {
            setMessages(prev => [...prev, { role: "assistant", content: response }]);
          }
          setStreamingContent("");
        },
        onError: (error) => {
          setAiError(error);
        }
      });

      // If no streaming happened, add the response directly
      if (result.response && !result.toolResults) {
        // Response already added via onComplete
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Failed to connect to LM Studio");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    if (!isVisible) return;
    const escListener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isAiMode && messages.length > 0) {
          setMessages([]);
          setStreamingContent("");
          setAiError(null);
          setAiInput("");
        } else {
          setIsVisible(false);
          setSearchTerm("");
          setIsAiMode(false);
          setMessages([]);
          setStreamingContent("");
          setAiError(null);
          setAiInput("");
        }
      }
    };
    window.addEventListener("keydown", escListener);
    return () => window.removeEventListener("keydown", escListener);
  }, [isVisible, isAiMode, messages.length]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const trimmedSearchTerm = searchTerm.trim();
      const lower = trimmedSearchTerm.toLowerCase();

      // Check for specific commands first
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

      // Default: send to AI if there's input
      if (trimmedSearchTerm) {
        setIsAiMode(true);
        setSearchTerm("");
        setAiInput("");
        setMessages([]);
        setStreamingContent("");
        setAiError(null);
        await sendAiQuery(trimmedSearchTerm);
        return;
      }

      setIsVisible(false);
      setSearchTerm("");
    } else if (event.key === "Escape") {
      setIsVisible(false);
      setSearchTerm("");
    }
  };

  const handleAiInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAiInput(event.target.value);
  };

  const handleAiKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && aiInput.trim() && !isAiLoading) {
      event.preventDefault();
      const query = aiInput.trim();
      setAiInput("");
      await sendAiQuery(query);
    } else if (event.key === "Escape") {
      if (messages.length > 0) {
        setMessages([]);
        setStreamingContent("");
        setAiError(null);
        setAiInput("");
      } else {
        setIsAiMode(false);
        setIsVisible(false);
      }
    }
  };

  if (!isVisible) return null;

  // AI Mode UI
  if (isAiMode) {
    const hasMessages = messages.length > 0 || streamingContent || aiError;

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-none" data-modal-open="true">
        <Terminal
          className={cn(
            "w-full max-w-2xl mx-auto shadow-2xl !bg-slate-900/95 border-slate-700 pointer-events-auto",
            hasMessages ? "!max-h-[70vh]" : "!max-h-[120px]"
          )}
        >
          <div className="flex flex-col h-full max-h-[70vh]">
            {hasMessages && (
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
              >
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "user" ? (
                      <div className="bg-emerald-600/30 border border-emerald-500/50 rounded-lg px-3 py-2 max-w-[80%]">
                        <p className="text-slate-200 font-mono text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ) : msg.role === "tool" ? (
                      <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg px-3 py-2 max-w-[90%]">
                        <p className="text-blue-400 font-mono text-xs mb-1 opacity-70">🔍 web search results</p>
                        <p className="text-slate-300 font-mono text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">{msg.content}</p>
                      </div>
                    ) : (
                      <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2 max-w-[90%]">
                        <p className="text-emerald-400 font-mono text-xs mb-1 opacity-70">{modelName}</p>
                        <p className="text-slate-200 font-mono text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}
                  </div>
                ))}

                {streamingContent && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2 max-w-[90%]">
                      <p className="text-emerald-400 font-mono text-xs mb-1 opacity-70">{modelName}</p>
                      <p className="text-slate-200 font-mono text-sm whitespace-pre-wrap">{streamingContent}</p>
                    </div>
                  </div>
                )}

                {isAiLoading && !streamingContent && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2">
                      <p className="text-emerald-400 font-mono text-xs mb-1 opacity-70">{modelName}</p>
                      <p className="text-slate-400 font-mono text-sm">thinking...</p>
                    </div>
                  </div>
                )}

                {aiError && (
                  <div className="flex justify-start">
                    <div className="bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2">
                      <p className="text-red-400 font-mono text-sm">{aiError}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center px-3 py-2 border-t border-slate-700/50">
              <span className="text-emerald-400 text-base sm:text-lg mr-2 font-mono">&gt;</span>
              <input
                ref={aiInputRef}
                type="text"
                value={aiInput}
                onChange={handleAiInputChange}
                onKeyDown={handleAiKeyDown}
                placeholder={isAiLoading ? "Waiting for response..." : "Ask anything..."}
                disabled={isAiLoading}
                className={cn(
                  "flex-grow bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none caret-emerald-400",
                  "font-mono text-base sm:text-lg",
                  "border-none p-0 m-0 appearance-none focus:ring-0",
                  isAiLoading && "opacity-50 cursor-not-allowed"
                )}
              />
            </div>
          </div>
        </Terminal>
      </div>
    );
  }

  // Normal command bar UI
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-none" data-modal-open="true">
      <Terminal
        className={cn(
          "w-full max-w-2xl mx-auto shadow-2xl !bg-slate-900/95 border-slate-700 !max-h-[120px] pointer-events-auto"
        )}
      >
        <div className="flex items-center px-1 py-1">
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
            placeholder="Enter a command..."
            className={cn(
              "flex-grow bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none caret-green-400",
              "font-mono text-base sm:text-lg",
              "border-none p-0 m-0 appearance-none focus:ring-0"
            )}
          />
        </div>
      </Terminal>
    </div>
  );
};

export default GlobalSearchInput;
