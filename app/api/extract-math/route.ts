import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export const maxDuration = 30;

interface ExtractMathRequest {
  imageData: string; // Base64 data URL
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
    const { imageData }: ExtractMathRequest = await req.json();

    if (!imageData) {
      return Response.json(
        { success: false, error: "No image data provided" },
        { status: 400 }
      );
    }

    // Check base64 size (4MB binary ≈ 5.3MB base64)
    const maxBase64Size = 5.5 * 1024 * 1024; // 5.5MB
    if (imageData.length > maxBase64Size) {
      return Response.json(
        { success: false, error: "Image too large. Maximum 4MB." },
        { status: 413 }
      );
    }

    // Validate it's actually a data URL
    if (!imageData.startsWith('data:image/')) {
      return Response.json(
        { success: false, error: "Invalid image format" },
        { status: 400 }
      );
    }

    // Use Claude Sonnet 4.5 for OCR - excellent vision capabilities
    const model = anthropic("claude-sonnet-4-5");

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            {
              type: "image",
              image: imageData, // Claude accepts base64 data URLs directly
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
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to parse OCR response as JSON:", parseError);
      }

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
    console.error("OCR extraction error:", {
      message: error instanceof Error ? error.message : "Unknown error"
    });

    return Response.json(
      {
        success: false,
        error: "Failed to extract math from image",
      },
      { status: 500 }
    );
  }
}
