import express from "express";
import cors from "cors";
import * as vectordb from "./vectordb.js";
import * as aiAgent from "./ai-agent.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Track if database is ready
let dbReady = false;

// Allow front-end dev server
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

// SEMANTIC SEARCH - find similar entries (must be before :id route)
app.get("/api/dd/search", async (req, res) => {
  const { q, limit = 10 } = req.query;
  if (!q) return res.status(400).json({ message: "query param 'q' required" });

  if (!dbReady) {
    return res.status(503).json({ message: "Database initializing..." });
  }

  try {
    const results = await vectordb.searchSimilar(q, parseInt(limit));
    res.json({ results, query: q });
  } catch (e) {
    console.error("Search failed:", e.message);
    res.status(500).json({ message: "Search failed" });
  }
});

// DATABASE STATUS (must be before :id route)
app.get("/api/dd/status", async (req, res) => {
  res.json({
    ready: dbReady,
    database: "chroma",
    message: dbReady ? "Database ready" : "Database initializing...",
  });
});

// GET list of entries with pagination
// Query params: ?limit=50&offset=0
app.get("/api/dd", async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: "Database initializing..." });
  }

  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await vectordb.getAllEntries(limit, offset);
    res.json(result);
  } catch (e) {
    console.error("Failed to get entries:", e.message);
    res.status(500).json({ message: "Failed to get entries" });
  }
});

// GET single entry
app.get("/api/dd/:id", async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: "Database initializing..." });
  }

  try {
    const entry = await vectordb.getEntry(req.params.id);
    if (!entry) return res.status(404).json({ message: "Not found" });
    res.json(entry);
  } catch (e) {
    console.error("Failed to get entry:", e.message);
    res.status(500).json({ message: "Failed to get entry" });
  }
});

// POST create new entry
app.post("/api/dd", async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: "Database initializing..." });
  }

  const { content } = req.body;
  if (!content) return res.status(400).json({ message: "content required" });

  const id = new Date().toISOString();
  const timestamp = new Date().toLocaleString();

  try {
    await vectordb.insertEntry(id, content, timestamp);
    res.status(201).json({ id, content, timestamp });
  } catch (e) {
    console.error("Failed to create entry:", e.message);
    res.status(500).json({ message: "Failed to create entry" });
  }
});

// PUT update entry
app.put("/api/dd/:id", async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: "Database initializing..." });
  }

  const { content } = req.body;
  if (content === undefined) {
    return res.status(400).json({ message: "content required" });
  }

  try {
    const exists = await vectordb.hasEntry(req.params.id);
    if (!exists) return res.status(404).json({ message: "Not found" });

    const timestamp = new Date().toLocaleString();
    await vectordb.updateEntry(req.params.id, content, timestamp);
    res.json({ id: req.params.id, content, timestamp });
  } catch (e) {
    console.error("Failed to update entry:", e.message);
    res.status(500).json({ message: "Failed to update entry" });
  }
});

// DELETE entry
app.delete("/api/dd/:id", async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: "Database initializing..." });
  }

  try {
    await vectordb.deleteEntry(req.params.id);
    res.status(204).end();
  } catch (e) {
    console.error("Failed to delete entry:", e.message);
    res.status(500).json({ message: "Failed to delete entry" });
  }
});

// AI CHAT - uses LM Studio SDK with native .act() tool calling
app.post("/api/ai/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: "message required" });

  if (!aiAgent.isReady()) {
    return res.status(503).json({ message: "AI not ready. Is LM Studio running?" });
  }

  // Set up SSE for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const response = await aiAgent.chat(message, (update) => {
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    });

    // Send final response
    res.write(`data: ${JSON.stringify({ type: "done", content: response })}\n\n`);
    res.end();
  } catch (e) {
    console.error("AI chat failed:", e.message);
    res.write(`data: ${JSON.stringify({ type: "error", message: e.message })}\n\n`);
    res.end();
  }
});

// AI STATUS - check if LM Studio is connected
app.get("/api/ai/status", async (req, res) => {
  res.json({
    ready: aiAgent.isReady(),
    model: await aiAgent.getModelName(),
  });
});

// Initialize Chroma connection
async function initDB() {
  try {
    console.log("Connecting to Chroma...");
    await vectordb.ensureCollection();
    dbReady = true;
    console.log("✅ Chroma ready - all data stored in vector database");
  } catch (e) {
    console.error("Chroma init failed (will retry):", e.message);
    setTimeout(initDB, 5000);
  }
}

app.listen(PORT, () => {
  console.log(`Diary API running on port ${PORT}`);
  console.log("Storage: Chroma vector database (dojodata/chroma/)");
  initDB();
  // Initialize AI agent (LM Studio SDK)
  aiAgent.initAI().then((ready) => {
    if (!ready) {
      console.log("⚠️  AI not available - start LM Studio to enable");
    }
  });
});
