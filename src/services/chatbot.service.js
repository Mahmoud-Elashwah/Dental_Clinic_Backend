const AppError = require("../utils/AppError");
const ollamaService = require("./ollama.service");
const bookingService = require("./booking.service");
const doctorsService = require("./doctors.service");
const conversationMemory = require("./conversationMemory.service");

const detectLanguage = (text) => {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  return "en";
};

const buildJsonResponse = ({ intent, message, data = {} }) => ({
  intent,
  message,
  data,
});

const mediaFriendlyMessage = (text, fallback) => {
  return String(text || fallback || "").trim();
};

exports.handleUserMessage = async (message, { sessionKey, user }) => {
  const memory = conversationMemory.getMemory(sessionKey);
  conversationMemory.addMessage(sessionKey, "user", message);

  const aiIntent = await ollamaService.classifyIntent(message, memory);
  const intent = aiIntent.intent || "UNKNOWN";
  const userLanguage = detectLanguage(message);
  let response;

  switch (intent) {
    case "GREETING": {
      const messageText = mediaFriendlyMessage(
        aiIntent.message,
        userLanguage === "ar"
          ? "أهلاً! كيف أقدر أساعدك النهارده؟"
          : "Hi! How can I help you today?",
      );
      response = buildJsonResponse({ intent, message: messageText, data: {} });
      break;
    }

    case "GET_DOCTORS": {
      const specialization = aiIntent.data?.specialization || null;
      const doctors = await doctorsService.findDoctors({ specialization });
      const messageText = doctors.length
        ? `I found ${doctors.length} doctor${doctors.length > 1 ? "s" : ""} for you.`
        : "I could not find matching doctors right now. Please try a different specialty.";
      response = buildJsonResponse({
        intent,
        message: messageText,
        data: { doctors, specialization },
      });
      break;
    }

    case "GET_AVAILABLE_SLOTS": {
      const date = aiIntent.data?.date;
      const doctorId = aiIntent.data?.doctorId;

      if (!date) {
        response = buildJsonResponse({
          intent,
          message: "Please provide a date in the format YYYY-MM-DD to check available slots.",
          data: {},
        });
        break;
      }

      const availableSlots = await bookingService.getAvailableSlots({ date, doctorId });
      const messageText = availableSlots.length
        ? `Here are the available slots for ${date}.`
        : `No available slots found for ${date}. Try another date or doctor.`;

      response = buildJsonResponse({
        intent,
        message: messageText,
        data: { date, doctorId: doctorId || null, availableSlots },
      });
      break;
    }

    case "BOOK_APPOINTMENT": {
      const doctorId = aiIntent.data?.doctorId || null;
      const date = aiIntent.data?.date || null;
      const note = aiIntent.data?.notes || null;
      const duration = aiIntent.data?.duration || null;
      const doctor = doctorId ? await doctorsService.getDoctorById(doctorId) : null;
      const availableSlots = date ? await bookingService.getAvailableSlots({ date, doctorId: doctorId || undefined }) : [];

      const messageText = doctor
        ? `I found Dr. ${doctor.name}. Tell me the slot you want to book or send the booking details.`
        : "I can help you book an appointment. Please share the doctor and date you prefer.";

      response = buildJsonResponse({
        intent,
        message: mediaFriendlyMessage(aiIntent.message, messageText),
        data: {
          doctor: doctor
            ? {
                id: doctor._id,
                name: doctor.name,
                specialization: doctor.specialization,
              }
            : null,
          date,
          duration,
          note,
          suggestedSlots: availableSlots,
        },
      });
      break;
    }

    case "CANCEL_APPOINTMENT": {
      const appointmentId = aiIntent.data?.appointmentId || null;

      if (!appointmentId) {
        response = buildJsonResponse({
          intent,
          message: "Please provide the appointment ID you want to cancel.",
          data: {},
        });
        break;
      }

      try {
        const appointment = await bookingService.getAppointmentById(appointmentId);
        const isOwner = user && appointment.patientId.toString() === user.id;
        const isAdmin = user && user.role === "admin";

        if (!isOwner && !isAdmin) {
          response = buildJsonResponse({
            intent,
            message: "I found the appointment, but I can only help cancel appointments for your account.",
            data: { appointmentId },
          });
          break;
        }

        response = buildJsonResponse({
          intent,
          message: `I found your appointment on ${appointment.date.toISOString().slice(0, 10)}. To cancel it, send a cancellation request to /api/v1/appointments/${appointment._id}/cancel`,
          data: {
            appointmentId: appointment._id,
            status: appointment.status,
            doctor: appointment.doctorId?.name || null,
            date: appointment.date,
          },
        });
      } catch (err) {
        if (err.statusCode === 404) {
          response = buildJsonResponse({
            intent,
            message: "I could not find that appointment. Please check the ID and try again.",
            data: { appointmentId },
          });
        } else {
          throw err;
        }
      }
      break;
    }

    case "FAQ": {
      response = buildJsonResponse({
        intent,
        message: mediaFriendlyMessage(aiIntent.message, "I can help with dental clinic questions. Ask me about appointments or doctors."),
        data: {},
      });
      break;
    }

    default: {
      response = buildJsonResponse({
        intent: "UNKNOWN",
        message: mediaFriendlyMessage(
          aiIntent.message,
          "I’m not sure I understood. Can you please rephrase your question?",
        ),
        data: {},
      });
    }
  }

  conversationMemory.addMessage(sessionKey, "assistant", response.message);
  return response;
};
