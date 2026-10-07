import Anthropic from "@anthropic-ai/sdk";
import { runAgent, type AgentEvent, type History } from "@/lib/agent";

export const dynamic = "force-dynamic";

// One history per browser conversation, kept in memory: enough for a local starter.
const conversations = new Map<string, History>();

function describe(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "The AI assistant is not configured: set ANTHROPIC_API_KEY in the .env file at the root of the starter, then restart the app.";
  }
  if (error instanceof Anthropic.RateLimitError) return "The LLM is rate limited, try again in a moment.";
  if (error instanceof Anthropic.APIError) return `LLM API error ${error.status}: ${error.message}`;
  // No credential at all: the SDK fails before sending the request.
  if (error instanceof Anthropic.AnthropicError) {
    return "The AI assistant is not configured: set ANTHROPIC_API_KEY in the .env file at the root of the starter, then restart the app.";
  }
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  const { conversationId, message } = (await request.json()) as { conversationId: string; message: string };
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const history = await runAgent(conversations.get(conversationId) ?? [], message, send);
        conversations.set(conversationId, history);
      } catch (error) {
        send({ type: "error", message: describe(error) });
      }
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
}
