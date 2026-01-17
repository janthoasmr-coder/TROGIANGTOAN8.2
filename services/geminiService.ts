import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message, Role, SYSTEM_PROMPT } from "../types";

let chatSession: Chat | null = null;

const getAiClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const initializeChat = () => {
  try {
    const ai = getAiClient();
    chatSession = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.4,
      }
    });
  } catch (error) {
    console.error("Failed to initialize chat:", error);
  }
};

export const sendMessageStream = async function* (
  message: string,
  history: Message[],
  imagePart?: { inlineData: { data: string; mimeType: string } }
) {
  if (!chatSession) {
    initializeChat();
  }
  if (!chatSession) {
    throw new Error("Chat session not initialized");
  }

  try {
    const msg = imagePart ? [message, imagePart] : message;
    const result = await chatSession.sendMessageStream({ message: msg });
    
    for await (const chunk of result) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        yield c.text;
      }
    }
  } catch (error) {
    console.error("Error in sendMessageStream:", error);
    throw error;
  }
};