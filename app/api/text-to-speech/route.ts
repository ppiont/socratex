import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    console.log("==== TEXT-TO-SPEECH REQUEST ====");

    // Check if API key is configured
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY not configured");
      return Response.json(
        { success: false, error: "Text-to-speech service not configured" },
        { status: 500 }
      );
    }

    const { text } = await req.json();

    if (!text) {
      console.error("No text provided");
      return Response.json(
        { success: false, error: "No text provided" },
        { status: 400 }
      );
    }

    console.log(`Converting text to speech: ${text.substring(0, 100)}...`);

    // Call ElevenLabs TTS API directly
    // Using their streaming endpoint for better performance
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", errorText);
      return Response.json(
        { success: false, error: "Failed to generate speech" },
        { status: 500 }
      );
    }

    console.log("TTS successful, streaming audio...");

    // Stream the audio response
    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Text-to-speech error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate speech",
      },
      { status: 500 }
    );
  }
}
