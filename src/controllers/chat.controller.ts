// import {GoogleGenerativeAI, type Content, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GoogleGenAI, HarmBlockThreshold, HarmCategory, type Content } from "@google/genai";
import { GEMINI_MODEL } from "../config/env.config.js";
import type { NextFunction, Request, Response } from "express";
import { getRedisClient } from "../config/redis.config.js";

const SYSTEM_PROMPT = `
You are an AI assistant specialized ONLY in Nigeria's 2026 tax reforms.

KNOWLEDGE BASE:
- 2026 Nigerian tax brackets and rates
- PAYE rules
- Deductions and relief caps
- Payment procedures and deadlines
- FIRS compliance requirements

RULES:
- ONLY answer questions related to Nigeria's 2026 tax system
- If a question is outside this scope, politely refuse and redirect to FIRS
- Do NOT provide legal advice
- Keep answers concise (2–4 sentences)
- Use bullet points for steps
- Suggest follow-up questions when helpful
- Reference FIRS processes when relevant

REFUSAL TEMPLATE:
"I'm specifically trained on Nigeria's 2026 tax reforms. For other questions, please visit the official FIRS website."

DISCLAIMER:
"This information is for guidance only and not legal advice."
`;

interface ChatBody {
  userID: string;
  prompt: string;
}

interface TaxContext {
  annualIncome?: number;
  taxOwed?: number;
  effectiveRate?: string;
}

export async function startChat(
  req: Request<{}, {}, ChatBody>,
  res: Response,
  next: NextFunction
) {
  try {
    const { userID, prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    if (!GEMINI_MODEL) {
      throw new Error("No Gemini model configured");
    }

    let taxContext: TaxContext | null = null;

    try {
      const redisClient = getRedisClient();
      const data = await redisClient.get(userID);
      if (data) {
        taxContext = JSON.parse(data);
      }
    } catch (error) {
      throw new Error(`Error getting tax context for user: ${userID} Invalid User ID`);
    }

    const ai = new GoogleGenAI({});

    /**
     * Optional calculation context (from calculator)
     * Example:
     * {
     *   annualIncome: 3500000,
     *   taxOwed: 225000,
     *   effectiveRate: "6.4%"
     * }
     */
    const calculationContext = taxContext
      ? `
          USER TAX CONTEXT:
          - Annual income: ₦${taxContext.annualIncome || "N/A"}
          - Tax owed: ₦${taxContext.taxOwed || "N/A"}
          - Effective tax rate: ${taxContext.effectiveRate || "N/A"}
        `
      : "";

    const chatHistory: Content[] = [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT + calculationContext }],
      },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I will only answer questions about Nigeria's 2026 tax reforms.",
          },
        ],
      },
    ];

    // 3. Create a chat session with history (NOT generateContent)
    const chat = ai.chats.create({
      model: GEMINI_MODEL,
      history: chatHistory,
      config: {
        maxOutputTokens: 500,
        temperature: 0.7,
        safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
      },
    });

    const result = await chat.sendMessage({ message:prompt });
    const text = result.text;
    res.json({ AIResponse: text });    
  } catch (error) {
    console.error("Error during chat:", error);
    next(error);
  }
}
