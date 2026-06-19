const ollamaService = require("./ollama.service");
const bookingService = require("./booking.service");
const doctorsService = require("./doctors.service");
const conversationMemory = require("./conversationMemory.service");
const mongoose = require("mongoose");

const detectLanguage = (text) => {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
};

const buildResponse = ({ intent, message, data = {} }) => ({
  intent,
  message,
  data,
});

const safeMessage = (text, fallback) => {
  return (text || fallback || "").trim();
};

const normalizeTime = (t) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return `${h}:${String(m).padStart(2, "0")}`;
};

exports.handleUserMessage = async (message, { sessionKey, user }) => {
  const memory = conversationMemory.getMemory(sessionKey);
  conversationMemory.addMessage(sessionKey, "user", message);

  const aiIntent = await ollamaService.classifyIntent(message, memory);
  const intent = aiIntent?.intent || "UNKNOWN";

  let response;

  switch (intent) {
    case "GREETING": {
      response = buildResponse({
        intent,
        message: safeMessage(
          aiIntent.message,
          "Hello! How can I assist you today?",
        ),
      });
      break;
    }

    case "GET_DOCTORS": {
      const specialization = aiIntent.data?.specialization || null;
      const doctors = await doctorsService.findDoctors({ specialization });

      response = buildResponse({
        intent,
        message: doctors.length
          ? `Found ${doctors.length} doctor${doctors.length > 1 ? "s" : ""}.`
          : "No doctors found for this specialization.",
        data: { doctors, specialization },
      });
      break;
    }

    case "GET_AVAILABLE_SLOTS": {
      const dateMatch = message.match(/\d{4}-\d{2}-\d{2}/);
      const date = aiIntent.data?.date || (dateMatch ? dateMatch[0] : null);
      let { doctorId } = aiIntent.data || {};
      const doctorName = aiIntent.data?.doctorName || null;

 

      if (!doctorId && doctorName) {
        const doctors = await doctorsService.findDoctors({ name: doctorName });

        if (doctors.length) doctorId = doctors[0].id || doctors[0]._id;

      }

      if (!date) {
        response = buildResponse({
          intent,
          message: "Please provide a date (YYYY-MM-DD).",
        });
        break;
      }

      const slots = await bookingService.getAvailableSlots({ date, doctorId });

      response = buildResponse({
        intent,
        message: slots.length
          ? `Available slots for ${date}.`
          : `No slots available for ${date}.`,
        data: { date, doctorId: doctorId || null, slots },
      });
      break;
    }

    case "BOOK_APPOINTMENT": {
      const { date, notes, duration, time } = aiIntent.data || {};
      let { doctorId } = aiIntent.data || {};
      const doctorName = aiIntent.data?.doctorName || null;

      if (!doctorId && doctorName) {
        const doctors = await doctorsService.findDoctors({ name: doctorName });
        if (doctors.length) doctorId = doctors[0].id || doctors[0]._id;
      }

      if (!doctorId || !date) {
        response = buildResponse({
          intent,
          message: !doctorId
            ? "Doctor not found, please try again."
            : "Please provide a date.",
        });
        break;
      }

      if (!user) {
        response = buildResponse({
          intent,
          message: "You must be logged in to book an appointment.",
        });
        break;
      }

      if (!time) {
        response = buildResponse({
          intent,
          message: "Please provide a time for the appointment.",
        });
        break;
      }

      const existingSlots = await bookingService.getAvailableSlots({
        date,
        doctorId,
      });
      const normalizedTime = normalizeTime(time);
      const isSlotTaken = !existingSlots.some(
        (slot) => slot.hour === normalizedTime,
      );

      if (isSlotTaken) {
        response = buildResponse({
          intent,
          message: `Slot ${time} is already booked for doctor ${doctorName}. Please choose another time.`,
          data: { date, doctorId },
        });
        break;
      }

      const appointment = await bookingService.createAppointment({
        doctorId,
        patientId: user.id,
        date,
        time,
        notes,
        duration,
      });

      const doctor = await doctorsService.getDoctorById(doctorId);

      response = buildResponse({
        intent,
        message: `Appointment booked on ${date} at ${time}.`,
        data: {
          appointmentId: appointment._id,
          date,
          doctorId,
          doctorName: doctor.name,
        },
      });
      break;
    }

    case "CANCEL_APPOINTMENT": {
      const rawAppointmentId = aiIntent.data?.appointmentId || null;
      const appointmentId = mongoose.Types.ObjectId.isValid(rawAppointmentId)
        ? rawAppointmentId
        : null;

      if (!user) {
        response = buildResponse({
          intent,
          message: "You must be logged in to cancel an appointment.",
        });
        break;
      }

      let resolvedAppointmentId = appointmentId;


      if (!resolvedAppointmentId) {
        const date = aiIntent.data?.date || null;
        let { doctorId } = aiIntent.data || {};
        const doctorName = aiIntent.data?.doctorName || null;

        if (!doctorId && doctorName) {
          const doctors = await doctorsService.findDoctors({
            name: doctorName,
          });
          if (doctors.length) doctorId = doctors[0].id || doctors[0]._id;
        }

        if (!date || !doctorId) {
          response = buildResponse({
            intent,
            message: "Please provide appointment ID or doctor name and date.",
          });
          break;
        }

        const found = await bookingService.findAppointment({
          patientId: user.id,
          doctorId,
          date,
        });
   

        if (!found) {
          response = buildResponse({
            intent,
            message: "No appointment found for this doctor and date.",
          });
          break;
        }

        resolvedAppointmentId = found._id;
      }

      try {
        const appointment = await bookingService.getAppointmentById(
          resolvedAppointmentId,
        );
        const isOwner = appointment.patientId._id
          ? appointment.patientId._id.toString() === user.id
          : appointment.patientId.toString() === user.id;
        const isAdmin = user.role === "admin";

        if (!isOwner && !isAdmin) {
          response = buildResponse({
            intent,
            message: "You can only cancel your own appointments.",
            data: { appointmentId: resolvedAppointmentId },
          });
          break;
        }

        await bookingService.cancelAppointment(resolvedAppointmentId);

        response = buildResponse({
          intent,
          message: `Appointment on ${appointment.date.toISOString().slice(0, 10)} at ${appointment.date.toISOString().slice(11, 16)} has been cancelled.`,
          data: {
            appointmentId: appointment._id,
            status: "cancelled",
            doctor: appointment.doctorId?.name || null,
            date: appointment.date,
          },
        });
      } catch (err) {
        if (err.statusCode === 404) {
          response = buildResponse({
            intent,
            message: "Appointment not found.",
            data: { appointmentId: resolvedAppointmentId },
          });
        } else {
          throw err;
        }
      }
      break;
    }

    case "FAQ": {
      response = buildResponse({
        intent,
        message: safeMessage(
          aiIntent.message,
          "I can help with doctors and appointments.",
        ),
      });
      break;
    }

    default: {
      response = buildResponse({
        intent: "UNKNOWN",
        message: safeMessage(
          aiIntent.message,
          "I didn't understand. Please rephrase.",
        ),
      });
    }
  }

  conversationMemory.addMessage(sessionKey, "assistant", response.message);
  return response;
};
