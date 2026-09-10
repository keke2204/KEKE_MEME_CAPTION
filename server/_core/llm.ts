import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};
export type MessageContent = string | TextContent | ImageContent;
export type Message = { role: Role; content: MessageContent | MessageContent[] };

type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type InvokeParams = {
  messages: Message[];
  maxTokens?: number;
  responseFormat?: {
    type: "text" | "json_object" | "json_schema";
    json_schema?: JsonSchema;
  };
  model?: string;
};

function normalizeContent(content: MessageContent | MessageContent[]) {
  if (typeof content === "string") return content;
  const parts = Array.isArray(content) ? content : [content];
  return parts.map(part => (typeof part === "string" ? { type: "text", text: part } : part));
}

export async function invokeLLM(params: InvokeParams) {
  if (!ENV.openAIKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    model: params.model || ENV.visionModel,
    messages: params.messages.map(message => ({
      role: message.role,
      content: normalizeContent(message.content),
    })),
    max_tokens: params.maxTokens ?? 700,
  };

  if (params.responseFormat) body.response_format = params.responseFormat;

  const response = await fetch(
    `${ENV.openAIBaseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.openAIKey}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as {
    choices: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
}
