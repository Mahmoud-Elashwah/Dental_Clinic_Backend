const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const AppError = require("../utils/AppError");

exports.getAvailableSlots = async ({ date, doctorId } = {}) => {
  if (!date) throw new AppError("Date is required", 400);

  const targetDate = new Date(date);
  if (Number.isNaN(targetDate.getTime()))
    throw new AppError("Invalid date format. Use YYYY-MM-DD.", 400);

  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const filter = {
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["pending", "confirmed"] },
  };
  if (doctorId)
    filter.doctorId = new mongoose.Types.ObjectId(doctorId.toString());

  const booked = await Appointment.find(filter).lean();
  console.log(
    "booked appointments:",
    booked.length,
    JSON.stringify(
      booked.map((a) => ({
        id: a._id,
        date: a.date,
        status: a.status,
        doctorId: a.doctorId,
      })),
    ),
  );
  const bookedTimes = new Set(
    booked.map((apt) => new Date(apt.date).getUTCHours()),
  );

  const allSlots = Array.from({ length: 9 }, (_, i) => i + 9);
  const freeSlots = allSlots
    .filter((hour) => !bookedTimes.has(hour))
    .map((hour) => {
      const slotDate = new Date(targetDate);
      slotDate.setUTCHours(hour, 0, 0, 0);
      return { time: slotDate, hour: `${hour}:00` };
    });

  return freeSlots;
};

exports.getAppointmentById = async (appointmentId) => {
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    throw new AppError("Invalid appointment id", 400);
  }

  const appointment = await Appointment.findById(appointmentId)
    .populate({ path: "doctorId", select: "name" })
    .populate({ path: "patientId", select: "name" });

  if (!appointment) throw new AppError("Appointment not found", 404);

  return appointment;
};

exports.createAppointment = async ({
  doctorId,
  patientId,
  date,
  time,
  notes,
  duration,
}) => {
  if (!doctorId || !patientId || !date) {
    throw new AppError("doctorId, patientId, and date are required", 400);
  }

  const appointmentDate = new Date(date);
  if (time) {
    const [hours, minutes] = time.split(":").map(Number);
    appointmentDate.setUTCHours(hours, minutes || 0, 0, 0);
  }

  if (Number.isNaN(appointmentDate.getTime())) {
    throw new AppError("Invalid date or time format", 400);
  }

  const appointment = await Appointment.create({
    doctorId,
    patientId,
    date: appointmentDate,
    duration: duration || 30,
    notes: notes || "",
    status: "pending",
  });

  return appointment;
};

exports.findAppointment = async ({ patientId, doctorId, date }) => {
  if (!patientId || !doctorId || !date) {
    throw new AppError("patientId, doctorId, and date are required", 400);
  }

  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const appointment = await Appointment.findOne({
    patientId,
    doctorId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["pending", "confirmed"] },
  });

  return appointment;
};

exports.cancelAppointment = async (appointmentId) => {
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    throw new AppError("Invalid appointment id", 400);
  }

  const appointment = await Appointment.findByIdAndUpdate(
    appointmentId,
    { status: "cancelled" },
    { new: true },
  );

  if (!appointment) throw new AppError("Appointment not found", 404);

  return appointment;
};
