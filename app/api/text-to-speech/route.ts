import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.ELEVENLABS_API_KEY) {
      if (process.env.NODE_ENV === 'development') {
        console.error("ELEVENLABS_API_KEY not configured");
      }
      return Response.json(
        { success: false, error: "Text-to-speech service not configured" },
        { status: 500 }
      );
    }

    const { text } = await req.json();

    if (!text) {
      return Response.json(
        { success: false, error: "No text provided" },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`TTS request: ${text.substring(0, 50)}...`);
    }

    // Call ElevenLabs TTS API with timeout
    // Using Callum voice - hoarse, mature, wise-sounding (perfect for Socrates)
    // Using non-streaming endpoint to get complete audio
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/N2lVS1w4EtoT3dr4eOWO`,
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
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.4,
            use_speaker_boost: true,
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      if (process.env.NODE_ENV === 'development') {
        console.error("ElevenLabs API error:", errorText);
      }
      return Response.json(
        { success: false, error: "Failed to generate speech" },
        { status: 500 }
      );
    }

    // Stream the audio response
    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Text-to-speech error:", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return Response.json(
      {
        success: false,
        error: "Failed to generate speech",
      },
      { status: 500 }
    );
  }
}
