import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod";
import { getAnthropic } from "./client";
import { estimateCostUsd } from "./pricing";
import { getProvider, type ModelSpec, type ProviderConfig } from "./providers";
import { STEP_CONFIG, type StepName } from "./router";

export interface UsageRecord {
  step: StepName;
  provider: ProviderConfig["name"];
  /** The model that actually served the request (differs after a fallback). */
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  durationMs: number;
  /** Provider request id, for reconciling against the provider's billing. */
  requestId: string | null;
}

export class AIStepError extends Error {
  constructor(
    readonly step: StepName,
    readonly reason: "refusal" | "truncated" | "invalid_output",
    message: string,
    /** The failed call was still billed. */
    readonly usage: UsageRecord,
  ) {
    super(message);
    this.name = "AIStepError";
  }
}

export interface StepRequest<Schema extends z.ZodType> {
  step: StepName;
  /** Must stay byte-identical across requests so it is served from the prompt cache. */
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: Schema;
}

// Providers that drop `output_config.format` still deliver tool calls, so there the
// result comes back as the input of this tool instead.
const RESULT_TOOL = "submit_result";
const RESULT_TOOL_INSTRUCTION = `Deliver your final answer by calling the ${RESULT_TOOL} tool exactly once. Never write the answer as text.`;

function rawOutput(response: Anthropic.Beta.BetaMessage, viaTool: boolean): unknown {
  if (viaTool) {
    return response.content.find(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use" && block.name === RESULT_TOOL,
    )?.input;
  }
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function runStructuredStep<Schema extends z.ZodType>({
  step,
  system,
  content,
  schema,
}: StepRequest<Schema>): Promise<{ output: z.infer<Schema>; usage: UsageRecord }> {
  const config = STEP_CONFIG[step];
  const provider = getProvider();
  const model = provider.models[config.tier];
  const jsonSchema = betaZodOutputFormat(schema).schema;
  const viaTool = !provider.structuredOutputs;
  const startedAt = Date.now();

  const { data: response, response: httpResponse } = await getAnthropic().beta.messages.create({
    model: model.id,
    max_tokens: config.maxTokens,
    stream: false,
    system: [
      {
        type: "text",
        text: viaTool ? `${system}\n\n${RESULT_TOOL_INSTRUCTION}` : system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content }],
    output_config: {
      ...(model.effort && { effort: config.effort }),
      ...(!viaTool && { format: { type: "json_schema", schema: jsonSchema } }),
    },
    ...(viaTool && {
      tools: [
        {
          name: RESULT_TOOL,
          description: "Submit the final result.",
          input_schema: jsonSchema as Anthropic.Beta.BetaTool.InputSchema,
          strict: true,
        },
      ],
      // Forced tool_choice is rejected by current models; the system prompt asks for the call.
      tool_choice: { type: "auto" },
    }),
    ...(model.refusalFallback && {
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    }),
  }).withResponse();

  // After a refusal fallback another model may have served the request; price it when we know it.
  const served: ModelSpec =
    Object.values(provider.models).find((candidate) => candidate.id === response.model) ?? model;
  const usage: UsageRecord = {
    step,
    provider: provider.name,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    costUsd: estimateCostUsd(served.pricing, response.usage),
    durationMs: Date.now() - startedAt,
    // Anthropic sends request-id; Wellflow sends x-request-id.
    requestId: httpResponse.headers.get("request-id") ?? httpResponse.headers.get("x-request-id"),
  };
  console.info("[ai_usage]", JSON.stringify(usage));

  if (response.stop_reason === "refusal") {
    throw new AIStepError(step, "refusal", response.stop_details?.explanation ?? "Request declined", usage);
  }
  if (response.stop_reason === "max_tokens") {
    throw new AIStepError(step, "truncated", `Output exceeded ${config.maxTokens} tokens`, usage);
  }
  // Validate even on the structured-output path: a gateway may not enforce the schema.
  const parsed = schema.safeParse(rawOutput(response, viaTool));
  if (!parsed.success) {
    const detail = parsed.error.message.slice(0, 500);
    throw new AIStepError(step, "invalid_output", `Response did not match the schema: ${detail}`, usage);
  }
  return { output: parsed.data, usage };
}
