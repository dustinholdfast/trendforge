import { HttpError } from "@/lib/http";

/**
 * Provider-switchable structured generation.
 *
 * Both providers are driven through the same interface: you hand in a JSON
 * Schema, you get back a parsed, validated object. Anthropic does this with a
 * forced tool call, OpenAI with `response_format: json_schema`. Neither is
 * asked to "return JSON" in the prompt — the API guarantees the shape, which
 * is why this is fast and doesn't need repair passes.
 *
 * Schemas must be strict-mode-safe for OpenAI: every object needs
 * `additionalProperties: false` and every property listed in `required`.
 */

export type ProviderName = "anthropic" | "openai";

export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
  [key: string]: unknown;
}

export interface StructuredRequest {
  system: string;
  prompt: string;
  schema: JsonSchema;
  schemaName: string;
  schemaDescription?: string;
  maxTokens?: number;
  temperature?: number;
  /** Overrides the env-configured model for this call. */
  model?: string;
}

export interface StructuredResult<T> {
  data: T;
  provider: ProviderName;
  model: string;
  latencyMs: number;
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  // Sonnet is the right default here: the generation call is latency-sensitive
  // (<15s end to end) and this is not a reasoning-heavy task.
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.6",
};

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "No AI provider configured. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) in .env.local.",
    );
    this.name = "AiNotConfiguredError";
  }
}

export function resolveProvider(): ProviderName {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "anthropic" || explicit === "openai") return explicit;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new AiNotConfiguredError();
}

export function isAiConfigured(): boolean {
  try {
    const provider = resolveProvider();
    return Boolean(
      provider === "anthropic"
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY,
    );
  } catch {
    return false;
  }
}

export function resolveModel(provider: ProviderName): string {
  return (
    process.env.AI_MODEL ??
    (provider === "anthropic"
      ? process.env.ANTHROPIC_MODEL
      : process.env.OPENAI_MODEL) ??
    DEFAULT_MODELS[provider]
  );
}

export async function generateStructured<T>(
  req: StructuredRequest,
): Promise<StructuredResult<T>> {
  const provider = resolveProvider();
  const model = req.model ?? resolveModel(provider);
  const started = Date.now();

  const data =
    provider === "anthropic"
      ? await callAnthropic<T>(req, model)
      : await callOpenAi<T>(req, model);

  return { data, provider, model, latencyMs: Date.now() - started };
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

interface AnthropicResponse {
  content?: Array<{ type: string; name?: string; input?: unknown; text?: string }>;
  error?: { message?: string };
}

async function callAnthropic<T>(
  req: StructuredRequest,
  model: string,
): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiNotConfiguredError();

  const body = {
    model,
    max_tokens: req.maxTokens ?? 8000,
    temperature: req.temperature ?? 1,
    system: req.system,
    tools: [
      {
        name: req.schemaName,
        description:
          req.schemaDescription ?? "Return the result in this exact shape.",
        input_schema: req.schema,
      },
    ],
    tool_choice: { type: "tool", name: req.schemaName },
    messages: [{ role: "user", content: req.prompt }],
  };

  const res = await postJson<AnthropicResponse>(
    "https://api.anthropic.com/v1/messages",
    body,
    {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
  );

  const toolUse = res.content?.find((c) => c.type === "tool_use");
  if (!toolUse?.input) {
    throw new HttpError(
      `Anthropic returned no tool_use block${
        res.error?.message ? `: ${res.error.message}` : ""
      }`,
    );
  }
  return toolUse.input as T;
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

interface OpenAiResponse {
  choices?: Array<{
    message?: { content?: string | null; refusal?: string | null };
    finish_reason?: string;
  }>;
  error?: { message?: string };
}

async function callOpenAi<T>(req: StructuredRequest, model: string): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiNotConfiguredError();

  const body: Record<string, unknown> = {
    model,
    max_completion_tokens: req.maxTokens ?? 8000,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: req.schemaName,
        schema: req.schema,
        strict: true,
      },
    },
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;

  const res = await postJson<OpenAiResponse>(
    `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/chat/completions`,
    body,
    {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
  );

  const choice = res.choices?.[0];
  if (choice?.message?.refusal) {
    throw new HttpError(`OpenAI refused the request: ${choice.message.refusal}`);
  }
  const content = choice?.message?.content;
  if (!content) {
    throw new HttpError(
      `OpenAI returned an empty response${
        res.error?.message ? `: ${res.error.message}` : ""
      }`,
    );
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new HttpError("OpenAI returned malformed JSON despite strict mode");
  }
}

// ---------------------------------------------------------------------------

async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  attempt = 0,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      // 429 / 5xx are worth one retry with backoff; 4xx are not.
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < 2) {
        clearTimeout(timer);
        await sleep(600 * 2 ** attempt);
        return postJson<T>(url, body, headers, attempt + 1);
      }
      throw new HttpError(
        `${res.status} from ${new URL(url).host}: ${text.slice(0, 300)}`,
        res.status,
      );
    }
    return JSON.parse(text) as T;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as Error)?.name === "AbortError") {
      throw new HttpError("AI request timed out after 90s", 408);
    }
    throw new HttpError((err as Error)?.message ?? "AI request failed");
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
