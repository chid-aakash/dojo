import { ChromaClient } from "chromadb";
import { pipeline } from "@huggingface/transformers";

const COLLECTION_NAME = "diary_entries";

let client = null;
let collection = null;
let embedder = null;

// Strip HTML tags and get plain text for embedding
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Initialize the embedding model (runs locally, no API key needed)
async function initEmbedder() {
  if (!embedder) {
    console.log("Loading embedding model (first time may download ~25MB)...");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("Embedding model ready!");
  }
  return embedder;
}

// Generate embedding for text
async function embed(text) {
  const model = await initEmbedder();
  const truncated = text.length > 50 ? text.slice(0, 50) + "..." : text;
  console.log(`🧠 Embedding: "${truncated}"`);
  const start = Date.now();
  const output = await model(text, { pooling: "mean", normalize: true });
  console.log(`   → 384-dim vector generated in ${Date.now() - start}ms`);
  return Array.from(output.data);
}

// Connect to Chroma
async function connect() {
  if (client) return client;

  client = new ChromaClient({ path: "http://localhost:8100" });

  // Wait for Chroma to be ready
  let retries = 0;
  while (retries < 30) {
    try {
      await client.heartbeat();
      console.log("Connected to Chroma!");
      break;
    } catch (e) {
      retries++;
      console.log(`Waiting for Chroma... (${retries}/30)`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return client;
}

// Get or create collection
async function ensureCollection() {
  if (collection) return collection;

  const client = await connect();

  // Get or create the collection
  collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: { "hnsw:space": "cosine" },
  });

  console.log("Collection ready:", COLLECTION_NAME);
  return collection;
}

// Insert a diary entry
async function insertEntry(id, content, timestamp) {
  const coll = await ensureCollection();
  const contentPlain = stripHtml(content);
  const vector = await embed(contentPlain);

  await coll.add({
    ids: [id],
    embeddings: [vector],
    metadatas: [{ content, content_plain: contentPlain, timestamp, created_at: Date.now() }],
    documents: [contentPlain],
  });

  console.log(`✅ Stored in Chroma: ${id}`);
  return { id, vectorized: true };
}

// Update an entry (delete + insert)
async function updateEntry(id, content, timestamp) {
  await deleteEntry(id);
  return insertEntry(id, content, timestamp);
}

// Delete an entry
async function deleteEntry(id) {
  const coll = await ensureCollection();
  try {
    await coll.delete({ ids: [id] });
  } catch (e) {
    // Ignore if not found
  }
}

// Get a single entry by ID
async function getEntry(id) {
  const coll = await ensureCollection();
  const result = await coll.get({ ids: [id], include: ["metadatas"] });

  if (result.ids.length === 0) return null;

  const meta = result.metadatas[0];
  return {
    id: result.ids[0],
    content: meta.content,
    timestamp: meta.timestamp,
    created_at: meta.created_at,
  };
}

// Get all entries with pagination (sorted by created_at desc)
async function getAllEntries(limit = 50, offset = 0) {
  const coll = await ensureCollection();

  // Get all entries
  const result = await coll.get({ include: ["metadatas"] });

  // Build entries array
  const entries = result.ids.map((id, i) => ({
    id,
    content: result.metadatas[i].content,
    timestamp: result.metadatas[i].timestamp,
    created_at: result.metadatas[i].created_at || 0,
  }));

  // Sort by created_at descending
  entries.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  const total = entries.length;

  // Paginate
  const paged = entries.slice(offset, offset + limit);

  return {
    entries: paged,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

// Semantic search - find similar entries
async function searchSimilar(query, limit = 10) {
  const coll = await ensureCollection();
  console.log(`🔍 Semantic search: "${query}"`);
  const queryVector = await embed(query);

  const results = await coll.query({
    queryEmbeddings: [queryVector],
    nResults: limit,
    include: ["metadatas", "distances"],
  });

  console.log(`   → Found ${results.ids[0]?.length || 0} similar entries`);

  return (results.ids[0] || []).map((id, i) => ({
    id,
    content: results.metadatas[0][i].content,
    timestamp: results.metadatas[0][i].timestamp,
    score: 1 - (results.distances[0][i] || 0), // Convert distance to similarity
  }));
}

// Check if entry exists
async function hasEntry(id) {
  const entry = await getEntry(id);
  return entry !== null;
}

// Get all IDs
async function getAllIds() {
  const coll = await ensureCollection();
  const result = await coll.get();
  return result.ids;
}

export {
  connect,
  ensureCollection,
  insertEntry,
  updateEntry,
  deleteEntry,
  searchSimilar,
  getEntry,
  getAllEntries,
  getAllIds,
  hasEntry,
  embed,
  stripHtml,
};
