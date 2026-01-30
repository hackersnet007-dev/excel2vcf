import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const suggestPrefix = async (sampleNames: string[]): Promise<string> => {
  const ai = getClient();
  if (!ai) return "";

  try {
    const prompt = `
      I have a contact list with names like: ${sampleNames.slice(0, 5).join(', ')}.
      Suggest a short, professional, and organizational prefix (max 5 chars) to add to these contacts for better sorting.
      Examples of output: "Biz -", "Lead-", "Gym -".
      Return ONLY the prefix text, nothing else.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const text = response.text?.trim() || "";
    // Remove quotes if the model adds them
    return text.replace(/^"|"$/g, '');
  } catch (error) {
    console.error("Error generating prefix:", error);
    return "";
  }
};