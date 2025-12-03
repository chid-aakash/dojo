/**
 * AI Agent using LM Studio OpenAI-compatible API with tool calling
 * Uses REST API for more stable tool calling with gpt-oss
 */

// LM Studio OpenAI-compatible endpoint
const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";
const LM_STUDIO_MODELS_URL = "http://localhost:1234/v1/models";

// SearxNG URL
const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8080/search";

// Track if LM Studio is available
let lmStudioReady = false;
let modelName = "gpt-oss";

/**
 * Initialize LM Studio connection
 */
export async function initAI() {
  try {
    const response = await fetch(LM_STUDIO_MODELS_URL);
    if (response.ok) {
      const data = await response.json();
      if (data.data?.[0]?.id) {
        modelName = data.data[0].id.split("/").pop()?.replace(".gguf", "") || "gpt-oss";
      }
      lmStudioReady = true;
      console.log("✅ LM Studio connected");
      return true;
    }
  } catch (e) {
    console.error("LM Studio connection failed:", e.message);
  }
  return false;
}

/**
 * Execute web search via SearxNG
 */
async function executeWebSearch(query) {
  try {
    // Check if query needs recent/current results
    const needsRecent = /\b(latest|recent|today|now|current|score|news|weather|live|tonight|yesterday)\b/i.test(query);

    const params = new URLSearchParams({
      q: query,
      format: "json",
      categories: needsRecent ? "news,general" : "general,news",
      language: "en",
    });

    // Add time_range for time-sensitive queries
    if (needsRecent) {
      params.set("time_range", "day");
    }

    const response = await fetch(`${SEARXNG_URL}?${params}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return `Search error: ${response.status}`;
    }

    const data = await response.json();
    let results = data.results || [];

    // For time-sensitive queries, prioritize results with dates
    if (needsRecent && results.length > 0) {
      // Sort by publishedDate if available, otherwise keep order
      results = results.sort((a, b) => {
        if (a.publishedDate && b.publishedDate) {
          return new Date(b.publishedDate) - new Date(a.publishedDate);
        }
        return 0;
      });
    }

    results = results.slice(0, 10);

    if (results.length === 0) {
      return "No search results found.";
    }

    return results
      .map((r, i) => {
        let entry = `${i + 1}. ${r.title}`;
        if (r.publishedDate) {
          entry += ` (${new Date(r.publishedDate).toLocaleDateString()})`;
        }
        entry += `\n   ${r.content || "No description"}`;
        if (r.url) {
          entry += `\n   Source: ${r.url}`;
        }
        return entry;
      })
      .join("\n\n");
  } catch (error) {
    return `Search failed: ${error.message}`;
  }
}

/**
 * Fetch and extract text content from a URL
 */
async function fetchUrl(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DojoBot/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      timeout: 10000
    });

    if (!response.ok) {
      return `Failed to fetch: ${response.status}`;
    }

    const html = await response.text();

    // Extract text content - remove scripts, styles, and HTML tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Truncate to reasonable length
    if (text.length > 8000) {
      text = text.substring(0, 8000) + "... [truncated]";
    }

    return text || "No readable content found on page.";
  } catch (error) {
    return `Fetch failed: ${error.message}`;
  }
}

/**
 * Get current model name
 */
export async function getModelName() {
  return modelName || "AI";
}

// Tool definitions for OpenAI-compatible API
const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web for current information, news, sports scores, weather, or any factual data. Use this to find URLs, then use fetch_url to get details from specific pages.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query"
        }
      },
      required: ["query"]
    }
  }
};

const FETCH_URL_TOOL = {
  type: "function",
  function: {
    name: "fetch_url",
    description: "Fetch and extract text content from a specific URL. Use this after web_search to get details from a page, like viewing a YouTube channel's recent videos or reading an article.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch content from"
        }
      },
      required: ["url"]
    }
  }
};

/**
 * Chat with AI agent - uses OpenAI-compatible API with tool calling
 */
export async function chat(userMessage, onUpdate) {
  if (!lmStudioReady) {
    throw new Error("AI not initialized. Is LM Studio running?");
  }

  const messages = [
    {
      role: "system",
      content: `You are a helpful assistant with web browsing capability. You have two tools:

1. web_search(query) - Search the web to find URLs and information
2. fetch_url(url) - Fetch content from a specific URL to get details

STRATEGY FOR FINDING INFORMATION:
- First use web_search to find relevant URLs and info
- CAREFULLY READ search results - the answer is often already there!
- Only use fetch_url if search results don't have the specific detail you need
- For YouTube/podcasts: search results often show recent episodes directly
- STOP SEARCHING when you have found the answer - don't over-search

CRITICAL RULES:
1. ONLY state facts that are EXPLICITLY present in the results you retrieved
2. If you can't find the specific information, say so honestly
3. NEVER make up scores, dates, names, or facts
4. If something hasn't happened yet, say so
5. Be persistent - try different search queries or fetch URLs if first attempt fails

Be concise and accurate. Accuracy is more important than having an answer.`
    },
    {
      role: "user",
      content: userMessage
    }
  ];

  const MAX_ITERATIONS = 8;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Call LM Studio with tools
    const response = await fetch(LM_STUDIO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "local-model",
        messages,
        tools: [WEB_SEARCH_TOOL, FETCH_URL_TOOL],
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 1000,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`LM Studio error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      throw new Error("No response from model");
    }

    // Check for tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls to history
      messages.push(assistantMessage);

      // Process each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        let result = "";

        if (toolCall.function?.name === "web_search") {
          const query = args.query;

          // Notify frontend
          if (onUpdate) {
            onUpdate({ type: "search_start", query });
          }

          // Execute search
          result = await executeWebSearch(query);

          // Notify frontend
          if (onUpdate) {
            onUpdate({ type: "search_results", results: result });
          }
        } else if (toolCall.function?.name === "fetch_url") {
          const url = args.url;

          // Notify frontend
          if (onUpdate) {
            onUpdate({ type: "fetch_start", url });
          }

          // Fetch URL content
          result = await fetchUrl(url);

          // Notify frontend
          if (onUpdate) {
            onUpdate({ type: "fetch_results", content: result.substring(0, 500) + "..." });
          }
        }

        // Add tool result to messages
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result
        });
      }

      // Continue loop to get model's response to tool results
      continue;
    }

    // No tool calls - this is the final response
    let content = assistantMessage.content || "";

    // Clean up gpt-oss special tokens if present
    const finalMatch = content.match(/<\|channel\|>final<\|message\|>([\s\S]*?)(?:<\|end\|>|$)/);
    if (finalMatch) {
      content = finalMatch[1].trim();
    }
    content = content.replace(/<\|[^|]+\|>/g, "").trim();

    // Stream the final response
    if (onUpdate && content) {
      onUpdate({ type: "stream", content });
    }

    return content;
  }

  return "I've searched multiple times but couldn't find a complete answer.";
}

/**
 * Check if AI is available
 */
export function isReady() {
  return lmStudioReady;
}
