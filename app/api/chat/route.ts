import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { SOCRATIC_PROMPT } from "@/lib/prompts";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("==== INCOMING REQUEST ====");
    console.log(JSON.stringify(body, null, 2));

    const { messages }: { messages: UIMessage[] } = body;

    if (!messages || !Array.isArray(messages)) {
      console.error("Invalid messages:", messages);
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400 }
      );
    }

    console.log("Calling Claude with", messages.length, "messages");

    // Using Claude Sonnet 4.5 - latest model with superior Socratic reasoning
    const result = streamText({
      model: anthropic("claude-sonnet-4-5"),
      system: SOCRATIC_PROMPT,
      messages: convertToModelMessages(messages),
      temperature: 0.7,
    });

    console.log("Streaming response...");
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500 }
    );
  }
}
