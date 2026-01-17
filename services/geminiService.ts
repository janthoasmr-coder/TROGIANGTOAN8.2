import { GoogleGenAI, Chat, GenerateContentResponse, Content } from "@google/genai";
import { Message, Role, SYSTEM_PROMPT } from "../types";

let chatSession: Chat | null = null;

const getAiClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Chưa cấu hình API Key. Vui lòng thêm API_KEY vào biến môi trường.");
  }
  return new GoogleGenAI({ apiKey });
};

const parseDataUrl = (dataUrl: string) => {
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return null;
    return { mimeType: matches[1], data: matches[2] };
};

// Convert app messages to Gemini history format
const convertHistory = (messages: Message[]): Content[] => {
  return messages
    .filter(m => m.id !== 'welcome' && !m.isStreaming && !m.text.includes("Xin lỗi, đã có lỗi xảy ra"))
    .map(m => {
      const parts: any[] = [{ text: m.text }];
      if (m.image) {
        const parsed = parseDataUrl(m.image);
        if (parsed) {
          parts.push({ inlineData: parsed });
        }
      }
      return {
        role: m.role,
        parts: parts
      };
    });
};

export const initializeChat = (history?: Message[]) => {
  // Allow errors to propagate (do not catch here)
  const ai = getAiClient();
  
  const geminiHistory = history ? convertHistory(history) : [];

  // Use gemini-3-pro-preview for better STEM/Math reasoning
  chatSession = ai.chats.create({
    model: "gemini-3-pro-preview",
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.4,
    },
    history: geminiHistory
  });
};

export const sendMessageStream = async function* (
  message: string,
  history: Message[],
  imagePart?: { inlineData: { data: string; mimeType: string } }
) {
  // If session doesn't exist, try to initialize it with current history
  if (!chatSession) {
    initializeChat(history);
  }

  if (!chatSession) {
    throw new Error("Không thể khởi tạo phiên chat.");
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
    // Reset session on error to force re-initialization next time
    chatSession = null;
    throw error;
  }
};