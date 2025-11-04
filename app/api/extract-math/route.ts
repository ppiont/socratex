import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

export const maxDuration = 30;

interface ExtractMathRequest {
  imageUrl: string;
}

interface ExtractMathResponse {
  success: boolean;
  problem?: string;
  latex?: string;
  error?: string;
}

const OCR_PROMPT = `You are a mathematical notation expert. Analyze the image and extract the math problem.

INSTRUCTIONS:
1. Identify all mathematical notation and equations in the image
2. Convert mathematical expressions to LaTeX format
3. Provide a clear description of the problem to be solved
4. If the image contains handwritten math, do your best to interpret it accurately

RESPONSE FORMAT:
Return a JSON object with:
- problem: A clear description of what needs to be solved
- latex: The mathematical notation in LaTeX format (use $ for inline, $$ for block math)

EXAMPLES:
- For "Solve: 2x + 5 = 13", return: {"problem": "Solve for x in the linear equation", "latex": "$2x + 5 = 13$"}
- For a quadratic formula image, return: {"problem": "Solve the quadratic equation", "latex": "$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$"}

Extract the math from this image:`;

export async function POST(req: Request) {
  try {
    const { imageUrl }: ExtractMathRequest = await req.json();

    if (!imageUrl) {
      return Response.json(
        { success: false, error: "No image URL provided" },
        { status: 400 }
      );
    }

    // Use GPT-4o Vision for production, Gemini Vision for development
    const isDevelopment = process.env.NODE_ENV === "development";

    const model = isDevelopment
      ? google("gemini-2.0-flash-exp")
      : openai("gpt-4o");

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            {
              type: "image",
              image: imageUrl,
            },
          ],
        },
      ],
      temperature: 0.2, // Lower temperature for more accurate OCR
    });

    // Try to parse the response as JSON
    let parsed: { problem?: string; latex?: string } = {};
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = result.text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : result.text;
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      // If JSON parsing fails, try to extract problem and latex from text
      console.error("Failed to parse OCR response as JSON:", parseError);

      // Fallback: use the raw text as the problem
      parsed = {
        problem: "Math problem from image",
        latex: result.text,
      };
    }

    return Response.json({
      success: true,
      problem: parsed.problem || "Math problem from image",
      latex: parsed.latex || result.text,
    });
  } catch (error) {
    console.error("OCR extraction error:", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract math from image",
      },
      { status: 500 }
    );
  }
}
