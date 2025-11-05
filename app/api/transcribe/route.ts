import { elevenlabs } from "@ai-sdk/elevenlabs";
import { experimental_transcribe as transcribe } from "ai";
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
        { success: false, error: "Speech-to-text service not configured" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return Response.json(
        { success: false, error: "No audio file provided" },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`Transcription: ${audioFile.name}, ${audioFile.size} bytes`);
    }

    // Convert File to Uint8Array
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioData = new Uint8Array(arrayBuffer);

    // Transcribe with ElevenLabs
    const result = await transcribe({
      model: elevenlabs.transcription("scribe_v1"),
      audio: audioData,
      providerOptions: {
        elevenlabs: {
          languageCode: "en", // English
          tagAudioEvents: false, // Don't tag sounds for math tutoring
          diarize: false, // Single speaker (student)
          timestampsGranularity: "none", // Don't need timestamps
        },
      },
    });

    return Response.json({
      success: true,
      text: result.text,
    });
  } catch (error) {
    console.error("Transcription error:", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to transcribe audio",
      },
      { status: 500 }
    );
  }
}
