/**
 * AI Service - Connects to backend which uses LM Studio SDK with native .act() tool calling
 *
 * Features:
 * - Streaming responses via SSE
 * - Native tool calling (web search)
 * - Auto-detects model name
 */

// Backend API base URL
const API_BASE = "/api/ai";

// Cached model info
let cachedModelName: string | null = null;

// Types
export interface ChatMessage {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  isToolResult?: boolean;
  toolName?: string;
}

export interface AIStreamCallbacks {
  onSearchStart?: (query: string) => void;
  onSearchResults?: (results: string) => void;
  onStreamChunk?: (content: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

/**
 * Chat with AI - uses backend SSE endpoint for streaming
 */
export async function chat(
  query: string,
  _conversationHistory: ChatMessage[],
  callbacks: AIStreamCallbacks
): Promise<{ response: string; toolResults?: ChatMessage }> {
  let fullResponse = "";
  let searchResults: string | null = null;

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: query }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Server error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error("No response stream");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6); // Remove "data: " prefix
        if (!data) continue;

        try {
          const event = JSON.parse(data);

          switch (event.type) {
            case "search_start":
              callbacks.onSearchStart?.(event.query);
              break;

            case "search_results":
              searchResults = event.results;
              callbacks.onSearchResults?.(event.results);
              break;

            case "stream":
              fullResponse = event.content;
              callbacks.onStreamChunk?.(event.content);
              break;

            case "done":
              fullResponse = event.content;
              callbacks.onComplete?.(event.content);
              break;

            case "error":
              callbacks.onError?.(event.message);
              throw new Error(event.message);
          }
        } catch (e) {
          // Skip invalid JSON
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    return {
      response: fullResponse,
      toolResults: searchResults
        ? {
            role: "tool",
            content: searchResults,
            isToolResult: true,
            toolName: "web_search",
          }
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI connection failed";
    callbacks.onError?.(message);
    return { response: "" };
  }
}

/**
 * Get the current model name from backend
 */
export async function getModelName(): Promise<string> {
  if (cachedModelName) return cachedModelName;

  try {
    const response = await fetch(`${API_BASE}/status`);
    if (response.ok) {
      const data = await response.json();
      if (data.model) {
        cachedModelName = data.model;
        return data.model;
      }
    }
  } catch {
    // Ignore errors
  }

  return "AI";
}

/**
 * Check if AI is available
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/status`);
    if (response.ok) {
      const data = await response.json();
      return data.ready;
    }
  } catch {
    // Ignore errors
  }
  return false;
}
