import {GoogleGenerativeAI, type Content, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../config/env.config.js";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

export async function startChat() {
    console.log(GEMINI_MODEL)
  // 1. Initialize the model
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL || "gemini-2.0-flash" 
  });

  // 2. Setup the chat history (optional: can be empty to start fresh)
  const chatHistory: Content[] = [
    {
      role: "user",
      parts: [{ text: "Hello! You are a helpful AI assistant." }],
    },
    {
      role: "model",
      parts: [{ text: "Understood. I am ready to help. How can I assist you today?" }],
    },
  ];

  const chat = model.startChat({
    history: chatHistory,
    generationConfig: {
      maxOutputTokens: 500,
      temperature: 0.7,
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  });

  // 3. Send a message
  const userPrompt = "Can you explain how neural networks work in 2 sentences?";
  console.log(`User: ${userPrompt}`);

  try {
    const result = await chat.sendMessage(userPrompt);
    console.log(result);
    const response = result.response;
    const text = response.text();
    
    console.log(`AI: ${text}`);
  } catch (error) {
    console.error("Error during chat:", error);
  }
}
