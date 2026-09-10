import fs from "node:fs";
import path from "node:path";

const dimensions = 96;
const root = process.cwd();
const corpus = JSON.parse(fs.readFileSync(path.join(root, "data/meme-corpus.json"), "utf8"));
const targetDirectory = process.env.RAG_DATA_DIR || "/data";
let destinationDirectory = targetDirectory;
try {
  fs.mkdirSync(targetDirectory, { recursive: true });
  fs.accessSync(targetDirectory, fs.constants.W_OK);
} catch {
  destinationDirectory = path.join(root, ".data");
  fs.mkdirSync(destinationDirectory, { recursive: true });
}

function hashToken(token) {
  let hash = 2166136261;
  for (const character of token) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % dimensions;
}
function embedding(text) {
  const vector = new Array(dimensions).fill(0);
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(token => token.length > 2);
  for (const token of tokens) {
    vector[hashToken(token)] += 1;
    if (token.length > 5) vector[hashToken(`${token.slice(0, 5)}-shape`)] += .35;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map(value => value / magnitude);
}

const items = corpus.map(entry => ({ ...entry, embedding: embedding([entry.template_name, entry.humor_style, entry.when_to_use.join(" "), entry.example_captions.join(" "), entry.tone].join(" ")) }));
const destination = path.join(destinationDirectory, "meme-vectors.json");
fs.writeFileSync(destination, JSON.stringify({ version: 1, dimensions, items }));
console.log(`Indexed ${items.length} meme entries into ${destination}`);
