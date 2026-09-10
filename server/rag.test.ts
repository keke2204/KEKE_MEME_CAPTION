import { describe, expect, it } from "vitest";
import { getRagStats, retrieveMemeInspiration } from "./rag";

describe("meme RAG store", () => {
  it("has a seeded corpus with the required meme fields", async () => {
    const stats = await getRagStats();
    expect(stats.entries).toBeGreaterThanOrEqual(100);
    expect(stats.store).toContain("meme-vectors.json");
  });

  it("returns ranked inspiration with template metadata", async () => {
    const results = await retrieveMemeInspiration("student deadline, coffee, stressful group project", 5);
    expect(results).toHaveLength(5);
    expect(results[0]).toMatchObject({
      template_name: expect.any(String),
      humor_style: expect.any(String),
      example_captions: expect.any(Array),
      score: expect.any(Number),
    });
    expect(results.every(item => item.score <= 1 && item.score >= -1)).toBe(true);
  });
});
