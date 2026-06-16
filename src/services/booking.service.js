const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const AppError = require("../utils/AppError");

exports.getAvailableSlots = async ({ date, doctorId } = {}) => {
  if (!date) {
    throw new AppError("Date is required to find available slots", 400);
  }

  const targetDate = new Date(date);
  if (Number.isNaN(targetDate.getTime())) {
    throw new AppError("Invalid date format. Use YYYY-MM-DD.", 400);
  }

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const filter = {
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["pending", "confirmed"] },
  };
  if (doctorId) filter.doctorId = doctorId;

  const appointments = await Appointment.find(filter)
    .populate({ path: "doctorId", select: "name" })
    .lean();

  return appointments.map((apt) => ({
    appointmentId: apt._id,
    doctorName: apt.doctorId?.name || null,
    date: apt.date,
    duration: apt.duration,
    status: apt.status,
  }));
};

exports.getAppointmentById = async (appointmentId) => {
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    throw new AppError("Invalid appointment id", 400);
  }

  const appointment = await Appointment.findById(appointmentId)
    .populate({ path: "doctorId", select: "name" })
    .populate({ path: "patientId", select: "name" });

  if (!appointment) {
    throw new AppError("Appointment not found", 404);
  }

  return appointment;
};
