import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { AIStepError, runStructuredStep } from "./run-step";

vi.mock("server-only", () => ({}));

const create = vi.fn();
vi.mock("./client", () => ({ getAnthropic: () => ({ beta: { messages: { create } } }) }));

function reply(text: string, stopReason = "end_turn", requestId = "req_1") {
  const data = {
    model: "claude-haiku-5-5",
    content: [{ type: "text", text }],
    stop_reason: stopReason,
    usage: { input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  };
  return { withResponse: async () => ({ data, response: new Response(null, { headers: { "request-id": requestId } }) }) };
}

const request = { step: "parse_jd" as const, system: "system", content: [], schema: z.object({ title: z.string() }) };

describe("runStructuredStep", () => {
  beforeEach(() => {
    create.mockReset();
    vi.stubEnv("AI_PROVIDER", "anthropic");
  });

  it("retries once when the output doesn't match the schema, and bills both calls", async () => {
    create.mockReturnValueOnce(reply("{}", "end_turn", "req_1")).mockReturnValueOnce(reply('{"title":"Dev"}', "end_turn", "req_2"));
    const { output, usage } = await runStructuredStep(request);

    expect(output).toEqual({ title: "Dev" });
    expect(create).toHaveBeenCalledTimes(2);
    expect(usage).toMatchObject({ inputTokens: 2000, outputTokens: 200, requestId: "req_1,req_2" });
  });

  it("gives up after the second invalid output", async () => {
    create.mockReturnValue(reply("not json"));
    const error = await runStructuredStep(request).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AIStepError);
    expect(error).toMatchObject({ reason: "invalid_output", usage: { inputTokens: 2000 } });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry a refusal", async () => {
    create.mockReturnValue(reply("", "refusal"));
    await expect(runStructuredStep(request)).rejects.toMatchObject({ reason: "refusal" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
