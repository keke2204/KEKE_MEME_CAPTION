export const ENV = {
  openAIBaseUrl:
    process.env.OPENAI_BASE_URL ||
    process.env.OPENAI_API_BASE_URL ||
    "https://api.openai.com/v1",
  openAIKey: process.env.OPENAI_API_KEY || "",
  visionModel: process.env.VISION_MODEL || "gpt-4o",
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
};
