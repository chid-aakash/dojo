import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3001;

// Allow front-end dev server
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

// Absolute directory for diary entries
const DATA_DIR = "/Users/aakashchid/dojodata";
const DIARY_DIR = path.join(DATA_DIR, "dd");

// Ensure directory exists
fs.mkdirSync(DIARY_DIR, { recursive: true });

// Helper to get file path
const entryPath = (id) => path.join(DIARY_DIR, `${id}.json`);

// GET list of entries with pagination
// Query params: ?limit=50&offset=0
app.get("/api/dd", (req, res) => {
  const limit = parseInt(req.query.limit) || 50; // Default 50 entries
  const offset = parseInt(req.query.offset) || 0;

  fs.readdir(DIARY_DIR, (err, files) => {
    if (err)
      return res.status(500).json({ message: "Failed to read directory" });

    // Sort filenames by date (newest first) without reading content
    const sortedFiles = files
      .filter((f) => f.endsWith(".json"))
      .sort((a, b) => b.localeCompare(a)); // ISO timestamps sort lexically

    const total = sortedFiles.length;

    // Only read the files we need for this page
    const pageFiles = sortedFiles.slice(offset, offset + limit);
    const entries = pageFiles.map((filename) => {
      const content = fs.readFileSync(
        path.join(DIARY_DIR, filename),
        "utf-8"
      );
      const data = JSON.parse(content);
      return { id: filename.replace(/\.json$/, ""), ...data };
    });

    res.json({
      entries,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  });
});

// GET single entry
app.get("/api/dd/:id", (req, res) => {
  const p = entryPath(req.params.id);
  if (!fs.existsSync(p)) return res.status(404).json({ message: "Not found" });
  const data = JSON.parse(fs.readFileSync(p, "utf-8"));
  res.json({ id: req.params.id, ...data });
});

// POST create new entry
app.post("/api/dd", (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: "content required" });
  const timestamp = new Date().toISOString();
  const fileId = timestamp;
  const payload = { timestamp: new Date().toLocaleString(), content };
  fs.writeFileSync(entryPath(fileId), JSON.stringify(payload, null, 2));
  res.status(201).json({ id: fileId, ...payload });
});

// PUT update / rename entry
app.put("/api/dd/:id", (req, res) => {
  const { content, newId } = req.body;
  const oldPath = entryPath(req.params.id);
  if (!fs.existsSync(oldPath))
    return res.status(404).json({ message: "Not found" });

  let finalId = req.params.id;

  if (newId && newId !== req.params.id) {
    const newPath = entryPath(newId);
    fs.renameSync(oldPath, newPath);
    finalId = newId;
  }

  if (content !== undefined) {
    const data = { timestamp: new Date().toLocaleString(), content };
    fs.writeFileSync(entryPath(finalId), JSON.stringify(data, null, 2));
  }

  res.json({ id: finalId });
});

// DELETE entry
app.delete("/api/dd/:id", (req, res) => {
  const p = entryPath(req.params.id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  res.status(204).end();
});

// DISABLED - simulate endpoints were creating 200k+ entries and freezing the app
// POST simulate diary entries
app.post("/api/dd/simulate", (req, res) => {
  res.status(403).json({ message: "Simulate endpoint disabled - too dangerous!" });
});

// DELETE simulated entries
app.delete("/api/dd/simulate", (req, res) => {
  res.status(403).json({ message: "Simulate endpoint disabled" });
});

app.listen(PORT, () => console.log(`Diary API running on port ${PORT}`));
