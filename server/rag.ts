import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENV } from "./_core/env";

type MemeEntry = {
  id: string;
  template_name: string;
  humor_style: string;
  when_to_use: string[];
  example_captions: string[];
  tone: string;
};

type VectorItem = MemeEntry & { embedding: number[] };

const VECTOR_DIMENSIONS = 96;
let cachedIndex: VectorItem[] | null = null;

function corpusPath() {
  const candidates = [
    path.resolve(process.cwd(), "data/meme-corpus.json"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data/meme-corpus.json"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/meme-corpus.json"),
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) ?? candidates[0];
}

function storageDirectory() {
  const requested = process.env.RAG_DATA_DIR || "/data";
  try {
    fs.mkdirSync(requested, { recursive: true });
    fs.accessSync(requested, fs.constants.W_OK);
    return requested;
  } catch {
    const fallback = path.resolve(process.cwd(), ".data");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function vectorPath() {
  return path.join(storageDirectory(), "meme-vectors.json");
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % VECTOR_DIMENSIONS;
}

function localEmbedding(text: string) {
  const vector = new Array<number>(VECTOR_DIMENSIONS).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 2);

  for (const token of tokens) {
    vector[hashToken(token)] += 1;
    if (token.length > 5) vector[hashToken(`${token.slice(0, 5)}-shape`)] += 0.35;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map(value => value / magnitude);
}

async function remoteEmbedding(text: string) {
  const baseUrl = ENV.openAIBaseUrl;
  const apiKey = ENV.openAIKey;
  if (process.env.RAG_EMBEDDINGS !== "remote" || !apiKey) return null;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ENV.embeddingModel,
      input: text,
    }),
  });
  if (!response.ok) throw new Error(`Embedding request failed with ${response.status}`);
  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  return payload.data?.[0]?.embedding ?? null;
}

async function embed(text: string) {
  try {
    return (await remoteEmbedding(text)) || localEmbedding(text);
  } catch (error) {
    console.warn("[RAG] Remote embedding unavailable; using local embedding:", error);
    return localEmbedding(text);
  }
}

function entryText(entry: MemeEntry) {
  return [
    entry.template_name,
    entry.humor_style,
    entry.when_to_use.join(" "),
    entry.example_captions.join(" "),
    entry.tone,
  ].join(" ");
}

function readCorpus(): MemeEntry[] {
  const file = corpusPath();
  if (!fs.existsSync(file)) throw new Error(`Meme corpus not found at ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as MemeEntry[];
}

async function buildIndex() {
  const corpus = readCorpus();
  const index: VectorItem[] = [];
  for (const entry of corpus) {
    index.push({ ...entry, embedding: await embed(entryText(entry)) });
  }
  const destination = vectorPath();
  const temporary = `${destination}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ version: 1, dimensions: index[0]?.embedding.length ?? VECTOR_DIMENSIONS, items: index }));
  fs.renameSync(temporary, destination);
  console.log(`[RAG] Seeded local vector store with ${index.length} meme entries at ${destination}`);
  return index;
}

async function getIndex() {
  if (cachedIndex) return cachedIndex;
  const destination = vectorPath();
  if (fs.existsSync(destination)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(destination, "utf8")) as { items?: VectorItem[] };
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        cachedIndex = parsed.items;
        return cachedIndex;
      }
    } catch (error) {
      console.warn("[RAG] Existing vector store could not be read; rebuilding:", error);
    }
  }
  cachedIndex = await buildIndex();
  return cachedIndex;
}

function cosineSimilarity(left: number[], right: number[]) {
  const dimensions = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < dimensions; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  return dot / ((Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)) || 1);
}

export async function retrieveMemeInspiration(query: string, topK = 5) {
  const index = await getIndex();
  const queryEmbedding = await embed(query);
  return index
    .map(item => ({
      template_name: item.template_name,
      humor_style: item.humor_style,
      when_to_use: item.when_to_use,
      example_captions: item.example_captions,
      tone: item.tone,
      score: Number(cosineSimilarity(queryEmbedding, item.embedding).toFixed(3)),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

export async function getRagStats() {
  const index = await getIndex();
  return {
    entries: index.length,
    store: vectorPath(),
    embeddingMode: process.env.RAG_EMBEDDINGS === "remote" ? "remote-compatible" : "local-hash",
  };
}
