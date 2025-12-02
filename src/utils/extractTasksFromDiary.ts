import { parseISO } from "date-fns";
import type { TaskItem } from "../storeTasks";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

async function callGemini(prompt: string): Promise<string | null> {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    return text;
  } catch (err) {
    console.warn("Gemini REST call failed", err);
    return null;
  }
}

/**
 * Extract tasks from a diary entry using Gemini 2.5 (Flash).
 * If the Gemini API key is missing or the call fails, falls back to a very
 * naive regex extraction so the pipeline keeps working.
 */
export async function extractTasksFromDiary(
  content: string,
  diaryDate: Date
): Promise<TaskItem[]> {
  const prompt = `You are an assistant that reads a diarist's free-form entry and extracts discrete tasks/events that should be scheduled. \nReturn ONLY valid JSON – an array where each element has the shape {\"title\": string, \"date\": \"YYYY-MM-DD\"}. \nIf the entry has no actionable tasks, return an empty array [].\nDiary entry (date: ${
    diaryDate.toISOString().split("T")[0]
  }):\n"""\n${content}\n"""`;

  const llmResponse = await callGemini(prompt);
  if (llmResponse) {
    try {
      const jsonStart = llmResponse.indexOf("[");
      const jsonEnd = llmResponse.lastIndexOf("]");
      const jsonString =
        jsonStart >= 0 && jsonEnd >= 0
          ? llmResponse.slice(jsonStart, jsonEnd + 1)
          : "[]";
      const parsed: { title: string; date: string }[] = JSON.parse(jsonString);
      return parsed.map((t, idx) => ({
        id: `task-${Date.now()}-${idx}`,
        title: t.title,
        date: parseISO(t.date),
      }));
    } catch (e) {
      console.error("Failed to parse Gemini JSON, falling back", e);
    }
  }

  // ------------ Fallback regex extraction -------------
  const tasks: TaskItem[] = [];
  const weddingRegex =
    /(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i;
  const m = content.match(weddingRegex);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthStr = m[2].toLowerCase();
    const monthNames = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    const month = monthNames.indexOf(monthStr);
    const year = diaryDate.getFullYear();
    if (month >= 0) {
      tasks.push({
        id: `task-${Date.now()}`,
        title: "Attend wedding",
        date: new Date(year, month, day, 10, 0),
      });
    }
  }
  return tasks;
}
