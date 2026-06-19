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

const MAX_MEMORY_TURNS = 10;

const sanitizeInput = (text) => {
  if (typeof text !== "string") return "";
  return text
    .replace(/[\r\n]{3,}/g, "\n\n")
    .replace(/[^\S\r\n]{4,}/g, "   ")
    .replace(/<\|.*?\|>/g, "")
    .trim()
    .slice(0, 1000);
};

const buildPrompt = (message, memory = []) => {
  const recentMemory = memory.slice(-MAX_MEMORY_TURNS);

  const history = recentMemory
    .map((entry) => {
      const role = entry.role === "user" ? "[User]" : "[Assistant]";
      return `${role}: ${sanitizeInput(entry.text)}`;
    })
    .join("\n");

  const sanitizedMessage = sanitizeInput(message);

  return `You are a dental clinic assistant. Extract user intent and data from their message. Return structured JSON only.
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
  "data": {
    "doctorName": "full doctor name extracted from message, or null",
    "doctorId": null,
    "date": "date in YYYY-MM-DD format extracted from message, or null",
   "time": "time in HH:MM 24h format. Examples: 5pm → 17:00, 2pm → 14:00, 10am → 10:00, 6pm → 18:00, 12pm → 12:00, 12am → 00:00. or null",
    "duration": "appointment duration in minutes if mentioned, or null",
    "notes": "any extra notes or symptoms mentioned, or null",
    "appointmentId": "appointment ID if user wants to cancel, or null",
    "specialization": "doctor specialization if user asks for doctors by type, or null"
  }
}

Extraction rules:
- ALWAYS extract doctorName if the user mentions any doctor name.
- ALWAYS extract date and convert it to YYYY-MM-DD format.
- ALWAYS extract time and convert to 24h HH:MM format (e.g. 6pm → 18:00, 10am → 10:00).
- NEVER return data as empty object {} if the user provided any details.
- If a field is not mentioned, set it to null.

Intent rules:
- GET_DOCTORS: user asks about doctors, available doctors, list doctors, "get available doctors", "show me doctors", "who are the doctors".
- GET_AVAILABLE_SLOTS: user asks about available TIME SLOTS or SCHEDULE for a SPECIFIC doctor. Must mention specific times or hours, not just doctors.
- BOOK_APPOINTMENT: user wants to book or schedule an appointment.
- CANCEL_APPOINTMENT: user wants to cancel an existing appointment.
- GREETING: user greets or opens the conversation.
- FAQ: general dental clinic questions not covered above.
- UNKNOWN: anything else or unclear intent.

Additional rules:
- Always reply in the same language the user used.
- Keep the message field friendly, short, and professional.
- If the user asks for medical advice, do not diagnose. Tell them to visit a doctor.
`;
};

const extractTextFromOllama = (data) => {
  if (!data) throw new Error("Empty response from Ollama.");

  if (typeof data.response === "string" && data.response.trim().length > 0) {
    return data.response;
  }

  const fallback = JSON.stringify(data);
  console.warn(
    "Ollama response missing expected `response` field. Raw payload:",
    fallback.slice(0, 300),
  );
  return fallback;
};

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
