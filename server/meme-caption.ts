import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { retrieveMemeInspiration } from "./rag";

export type MemeCaption = {
  label: "Short" | "Relatable" | "Over-the-top";
  top: string;
  bottom: string;
};

export type MemeResult = {
  description: string;
  retrieved: Array<{
    template_name: string;
    humor_style: string;
    when_to_use: string[];
    example_captions: string[];
    tone: string;
    score: number;
  }>;
  captions: MemeCaption[];
  memeImageUrl: string;
  usedFallback: boolean;
};

type VisionDescription = {
  subjects: string[];
  setting: string;
  expressions: string[];
  objects: string[];
  action: string;
  mood: string;
  readable_text: string[];
  summary: string;
};

const captionSchema = {
  name: "meme_captions",
  schema: {
    type: "object",
    properties: {
      captions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            label: { type: "string", enum: ["Short", "Relatable", "Over-the-top"] },
            top: { type: "string" },
            bottom: { type: "string" },
          },
          required: ["label", "top", "bottom"],
          additionalProperties: false,
        },
      },
    },
    required: ["captions"],
    additionalProperties: false,
  },
  strict: true,
};

const visionSchema = {
  name: "image_description",
  schema: {
    type: "object",
    properties: {
      subjects: { type: "array", items: { type: "string" } },
      setting: { type: "string" },
      expressions: { type: "array", items: { type: "string" } },
      objects: { type: "array", items: { type: "string" } },
      action: { type: "string" },
      mood: { type: "string" },
      readable_text: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
    required: ["subjects", "setting", "expressions", "objects", "action", "mood", "readable_text", "summary"],
    additionalProperties: false,
  },
  strict: true,
};

function contentText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(part => (typeof part === "string" ? part : (part as { text?: string }).text || "")).join("\n");
  return "";
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned) as T;
}

function makeDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function compactDescription(description: VisionDescription) {
  return [
    description.summary,
    `Subjects: ${description.subjects.join(", ")}`,
    `Setting: ${description.setting}`,
    `Expressions: ${description.expressions.join(", ")}`,
    `Objects: ${description.objects.join(", ")}`,
    `Action: ${description.action}`,
    `Mood: ${description.mood}`,
    description.readable_text.length ? `Readable text: ${description.readable_text.join(", ")}` : "No readable text",
  ].join(" | ");
}

function fallbackDescription(fileName: string): VisionDescription {
  const normalized = fileName.toLowerCase();
  const hint = normalized.includes("cat") ? "a cat" : normalized.includes("dog") ? "a dog" : "the uploaded photo";
  return {
    subjects: [hint],
    setting: "an unspecified everyday setting",
    expressions: ["not reliably detected"],
    objects: ["the uploaded image"],
    action: "captured in a still moment",
    mood: "open to a playful interpretation",
    readable_text: [],
    summary: `A photo featuring ${hint}; add an API key for richer vision grounding.`,
  };
}

async function invokeExternalStructured(
  messages: Parameters<typeof invokeLLM>[0]["messages"],
  schema: typeof visionSchema | typeof captionSchema
) {
  if (!ENV.openAIKey) return null;

  const response = await fetch(
    `${ENV.openAIBaseUrl.replace(/\\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.openAIKey}`,
      },
      body: JSON.stringify({
        model: ENV.visionModel,
        messages,
        max_tokens: 700,
        response_format: { type: "json_schema", json_schema: schema },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`AI request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return parseJson<unknown>(payload.choices?.[0]?.message?.content || "{}");
}

async function invokeStructured(messages: Parameters<typeof invokeLLM>[0]["messages"], schema: typeof visionSchema | typeof captionSchema) {
  const external = await invokeExternalStructured(messages, schema);
  if (external) return external;
  const response = await invokeLLM({
    messages,
    maxTokens: 700,
    responseFormat: { type: "json_schema", json_schema: schema },
  });
  return parseJson<unknown>(contentText(response.choices[0]?.message.content));
}

async function describeImage(imageDataUrl: string, fileName: string) {
  if (!ENV.openAIKey) return { description: fallbackDescription(fileName), usedFallback: true };

  try {
    const description = await invokeStructured([
      {
        role: "system",
        content: "You are a precise, safety-conscious image describer for a meme generator. Only state what is visible. Never identify a real person or infer sensitive traits. Return concise structured JSON.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe the uploaded image for a funny but accurate campus-safe caption. Mention visible subjects, setting, facial expressions, objects, action, mood, and any readable text. Do not invent details.",
          },
          { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
        ],
      },
    ], visionSchema) as VisionDescription;
    return { description, usedFallback: false };
  } catch (error) {
    console.warn("[Caption] Vision call failed; using fallback description:", error);
    return { description: fallbackDescription(fileName), usedFallback: true };
  }
}

function safeCaption(value: string, maxLength = 88) {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function fallbackCaptions(description: VisionDescription): MemeCaption[] {
  const subject = description.subjects[0] || "this photo";
  const action = description.action || "trying to look productive";
  return [
    { label: "Short", top: "ME: I HAVE A PLAN", bottom: safeCaption(`THE PLAN: ${action.toUpperCase()}`) },
    { label: "Relatable", top: safeCaption(`Nobody: absolutely nobody:`), bottom: safeCaption(`Me when ${subject} appears in the group project chat`) },
    { label: "Over-the-top", top: "THE DEADLINE WAS YESTERDAY", bottom: safeCaption(`${subject.toUpperCase()} HAS ENTERED FINAL-BOSS MODE`) },
  ];
}

async function generateCaptions(description: VisionDescription, retrieved: Awaited<ReturnType<typeof retrieveMemeInspiration>>) {
  if (!ENV.openAIKey) return { captions: fallbackCaptions(description), usedFallback: true };

  try {
    const inspiration = retrieved.map(item => ({
      template: item.template_name,
      style: item.humor_style,
      tone: item.tone,
      examples: item.example_captions,
      match: item.score,
    }));
    const result = await invokeStructured([
      {
        role: "system",
        content: "You write faculty-safe, PG-13 meme captions. Match only visible facts from the image description. Do not target or identify real people. Use the retrieved meme inspiration as patterns, not as text to copy. Keep each line punchy and under 88 characters. Return exactly three options with labels Short, Relatable, and Over-the-top.",
      },
      {
        role: "user",
        content: JSON.stringify({ image_description: description, retrieved_inspiration: inspiration }),
      },
    ], captionSchema) as { captions: MemeCaption[] };

    const normalized = ["Short", "Relatable", "Over-the-top"].map(label => result.captions.find(caption => caption.label === label)).filter(Boolean).map(caption => ({
      label: caption!.label,
      top: safeCaption(caption!.top),
      bottom: safeCaption(caption!.bottom),
    })) as MemeCaption[];
    if (normalized.length !== 3) throw new Error("Caption model returned an incomplete set");
    return { captions: normalized, usedFallback: false };
  } catch (error) {
    console.warn("[Caption] Generation failed; using fallback captions:", error);
    return { captions: fallbackCaptions(description), usedFallback: true };
  }
}

export async function createMemeResult({ buffer, mimeType, fileName }: { buffer: Buffer; mimeType: string; fileName: string }): Promise<MemeResult> {
  const imageDataUrl = makeDataUrl(buffer, mimeType);
  const vision = await describeImage(imageDataUrl, fileName);
  const descriptionText = compactDescription(vision.description);
  const retrieved = await retrieveMemeInspiration(descriptionText, 5);
  const generated = await generateCaptions(vision.description, retrieved);
  return {
    description: descriptionText,
    retrieved,
    captions: generated.captions,
    memeImageUrl: imageDataUrl,
    usedFallback: vision.usedFallback || generated.usedFallback,
  };
}

export async function regenerateCaptionOptions(descriptionText: string, retrieved: Awaited<ReturnType<typeof retrieveMemeInspiration>>) {
  const description: VisionDescription = {
    subjects: [descriptionText.slice(0, 120)],
    setting: "the uploaded image",
    expressions: [],
    objects: [],
    action: descriptionText,
    mood: "playful",
    readable_text: [],
    summary: descriptionText,
  };
  return generateCaptions(description, retrieved);
}
