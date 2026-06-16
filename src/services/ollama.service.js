const axios = require("axios");
const AppError = require("../utils/AppError");

const OLLAMA_URL =
  process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

const VALID_INTENTS = [
  "BOOK_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "GET_DOCTORS",
  "GET_AVAILABLE_SLOTS",
  "FAQ",
  "GREETING",
  "UNKNOWN",
];

const MAX_MEMORY_TURNS = 10; // keep last 5 user/assistant pairs

/**
 * Sanitizes user input to prevent prompt injection attacks.
 * Strips characters commonly used to break out of prompt context.
 */
const sanitizeInput = (text) => {
  if (typeof text !== "string") return "";
  return text
    .replace(/[\r\n]{3,}/g, "\n\n") // collapse excessive newlines
    .replace(/[^\S\r\n]{4,}/g, "   ") // collapse excessive spaces
    .replace(/<\|.*?\|>/g, "") // strip LLaMA special tokens e.g. <|im_start|>
    .trim()
    .slice(0, 1000); // hard cap per message
};

/**
 * Builds the structured prompt sent to Ollama.
 * Memory is capped to avoid token limit issues.
 */
const buildPrompt = (message, memory = []) => {
  const recentMemory = memory.slice(-MAX_MEMORY_TURNS);

  const history = recentMemory
    .map((entry) => {
      const role = entry.role === "user" ? "[User]" : "[Assistant]";
      return `${role}: ${sanitizeInput(entry.text)}`;
    })
    .join("\n");

  const sanitizedMessage = sanitizeInput(message);

  return `You are a dental clinic backend assistant. You only need to understand user intent and provide structured JSON. Do not execute any business logic.
The user may speak English or Egyptian Arabic.
If the user asks for medical advice, do not provide a diagnosis. Redirect them to visit a doctor.

Conversation history:
${history || "(no previous conversation)"}

[User]: ${sanitizedMessage}

Respond with valid JSON only. No markdown, no code fences, no extra text before or after.
The JSON must follow this exact schema:
{
  "intent": "BOOK_APPOINTMENT|CANCEL_APPOINTMENT|GET_DOCTORS|GET_AVAILABLE_SLOTS|FAQ|GREETING|UNKNOWN",
  "message": "A short friendly reply in the same language as the user.",
  "data": {}
}

Rules:
- GET_DOCTORS: user asks about available doctors.
- GET_AVAILABLE_SLOTS: user asks about available times or schedule.
- BOOK_APPOINTMENT: user wants to book an appointment.
- CANCEL_APPOINTMENT: user wants to cancel an appointment.
- GREETING: user greets or opens the conversation.
- FAQ: general dental clinic questions not covered above.
- UNKNOWN: anything else or unclear intent.
- Always reply in the same language the user used.
- Keep replies friendly, short, and professional.
`;
};

/**
 * Extracts the raw text response from Ollama's /api/generate response.
 * Ollama with stream:false always returns { response: string }.
 */
const extractTextFromOllama = (data) => {
  if (!data) throw new Error("Empty response from Ollama.");

  if (typeof data.response === "string" && data.response.trim().length > 0) {
    return data.response;
  }

  // Fallback: stringify entire payload so parseJson can attempt extraction
  const fallback = JSON.stringify(data);
  console.warn(
    "Ollama response missing expected `response` field. Raw payload:",
    fallback.slice(0, 300),
  );
  return fallback;
};

/**
 * Extracts the first valid JSON object from a string.
 * Handles cases where the model wraps output in prose or code fences.
 */
const parseJson = (rawText) => {
  const trimmed = String(rawText || "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No valid JSON object found in response.");
  }

  const candidate = trimmed.slice(firstBrace, lastBrace + 1);
  return JSON.parse(candidate);
};

/**
 * Validates and normalises the parsed assistant response.
 * Returns a guaranteed safe object regardless of what the model returned.
 */
const validateAssistantResponse = (parsed) => {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Parsed response is not a plain object.");
  }

  const rawIntent = String(parsed.intent || "").toUpperCase();
  const intent = VALID_INTENTS.includes(rawIntent) ? rawIntent : "UNKNOWN";

  const message =
    typeof parsed.message === "string" && parsed.message.trim().length > 0
      ? parsed.message.trim()
      : "I could not understand that. Please try again.";

  if (
    typeof parsed.data !== "object" ||
    parsed.data === null ||
    Array.isArray(parsed.data)
  ) {
    console.warn(
      "Assistant returned non-object `data` field:",
      JSON.stringify(parsed.data),
    );
  }

  const data =
    typeof parsed.data === "object" &&
    parsed.data !== null &&
    !Array.isArray(parsed.data)
      ? parsed.data
      : {};

  return { intent, message, data };
};

/**
 * Classifies a user message into a structured intent object.
 *
 * @param {string} message - The raw user message.
 * @param {Array<{role: string, text: string}>} memory - Conversation history.
 * @returns {Promise<{intent: string, message: string, data: object}>}
 */
exports.classifyIntent = async (message, memory = []) => {
  const prompt = buildPrompt(message, memory);

  let response;
  try {
    response = await axios.post(
      OLLAMA_URL,
      {
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
      },
      {
        timeout: 20000,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Ollama request failed:", {
      message: err.message,
      code: err.code,
      status: err.response?.status,
    });
    throw new AppError("AI integration failed. Please try again later.", 502);
  }

  try {
    const rawText = extractTextFromOllama(response.data);
    const parsed = parseJson(rawText);
    return validateAssistantResponse(parsed);
  } catch (parseError) {
    console.error("Ollama response processing failed:", {
      error: parseError.message,
      raw: String(response.data?.response || "").slice(0, 300),
    });
    return {
      intent: "UNKNOWN",
      message: "I'm sorry, I could not understand that. Please try again.",
      data: {},
    };
  }
};
