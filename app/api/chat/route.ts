import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { SOCRATIC_PROMPT } from "@/lib/prompts";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { messages }: { messages: UIMessage[] } = body;

    if (!messages || !Array.isArray(messages)) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Invalid messages format");
      }
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("Chat request", {
        messageCount: messages.length,
        hasAttachments: messages.some(m => m.parts.some(p => p.type === 'file'))
      });
    }

    // Using Claude Sonnet 4.5 - latest model with superior Socratic reasoning
    const result = streamText({
      model: anthropic("claude-sonnet-4-5"),
      system: SOCRATIC_PROMPT,
      messages: convertToModelMessages(messages),
      temperature: 0.7,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
