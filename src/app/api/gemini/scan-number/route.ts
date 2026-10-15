import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// Initialize lazy to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured in Settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image } = body; // base64 encoded image

    if (!image) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    // Clean base64 if it has data prefix
    let cleanBase64 = image;
    let mimeType = "image/jpeg";
    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = match[2];
      }
    }

    const ai = getGeminiClient();

    const imagePart = {
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: "This is an image of a barcode, but the camera was unable to scan the barcode lines successfully.\n" +
            "Your task is to locate the printed numeric digits (usually EAN-13, EAN-8, UPC, Code 128, etc. digits printed below or around the barcode lines) in this image.\n" +
            "Please read and extract ONLY the numerical sequence of digits.\n" +
            "Do not include spaces, hyphens, brackets, letters, or any other characters in your output.\n" +
            "Response format: Return ONLY the pure numeric string (e.g. '9780892132683') and absolutely nothing else. If no barcode digits can be found or read, reply 'NOT_FOUND'.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [imagePart, textPart],
      },
    });

    const resultText = response.text ? response.text.trim() : "";
    console.log("Gemini Barcode OCR result:", resultText);

    // Extract any pure number from the result just in case there's markdown or extra space
    let finalCode = "";
    if (resultText && resultText !== "NOT_FOUND") {
      // Find first sequence of 5 or more digits (UPC/EAN barcodes are usually 8, 12, or 13 digits)
      const numberMatch = resultText.match(/\d{5,}/);
      if (numberMatch) {
        finalCode = numberMatch[0];
      } else {
        // Fallback to removing non-digits
        const digitsOnly = resultText.replace(/\D/g, "");
        if (digitsOnly.length >= 5) {
          finalCode = digitsOnly;
        }
      }
    }

    return NextResponse.json({ 
      barcode: finalCode || null,
      rawText: resultText 
    });

  } catch (error: any) {
    console.error("Gemini OCR error:", error);
    return NextResponse.json(
      { error: error?.message || "An error occurred during scanning" },
      { status: 500 }
    );
  }
}
