import type { AnalysisErrorCode, AnalysisEvent, AnalysisStage } from "./types";

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AnalysisEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as AnalysisEvent;
    }
  }
}

/** Posts to /api/analyze from the browser and follows its NDJSON progress stream. */
export async function requestAnalysis(
  body: FormData,
  onStage: (stage: AnalysisStage) => void,
): Promise<{ analysisId: string } | { error: AnalysisErrorCode }> {
  try {
    const response = await fetch("/api/analyze", { method: "POST", body });
    if (!response.ok || !response.body) {
      const event = (await response.json().catch(() => null)) as AnalysisEvent | null;
      return { error: event?.type === "error" ? event.code : "server" };
    }
    for await (const event of readEvents(response.body)) {
      if (event.type === "stage") onStage(event.stage);
      else if (event.type === "result") return { analysisId: event.analysisId };
      else return { error: event.code };
    }
    // The stream closed without a result, e.g. the function timed out.
    return { error: "server" };
  } catch {
    return { error: "server" };
  }
}
