import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ScheduleItem {
  day: string;
  date: string;
  shift: string;
  notes?: string;
}

export interface ExtractionResult {
  personName: string;
  schedule: ScheduleItem[];
  summary: string;
}

export async function extractScheduleFromImage(
  base64Image: string,
  mimeType: string,
  targetPerson: string
): Promise<ExtractionResult> {
  const prompt = `
    Analyze this staff roster image and extract the work schedule for the person named "${targetPerson}".
    
    Instructions:
    1. Identify the row or section corresponding to "${targetPerson}".
    2. Extract each shift assigned to them, including the day, date (in YYYY-MM-DD format if possible, otherwise as written), and shift times/details.
    3. If there are specific notes for a shift, include them.
    4. Provide a brief summary of their total hours or key shifts if possible.
    
    Return the data in a structured JSON format.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Image.split(",")[1] || base64Image,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          personName: { type: Type.STRING },
          schedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                date: { type: Type.STRING },
                shift: { type: Type.STRING },
                notes: { type: Type.STRING },
              },
              required: ["day", "date", "shift"],
            },
          },
          summary: { type: Type.STRING },
        },
        required: ["personName", "schedule", "summary"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from Gemini");
  }

  try {
    return JSON.parse(text) as ExtractionResult;
  } catch (e) {
    console.error("Failed to parse Gemini response:", text);
    throw new Error("Failed to parse schedule data");
  }
}
