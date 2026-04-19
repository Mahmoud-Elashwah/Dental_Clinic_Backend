const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const catchAsync = require("../utils/CatchAsync");
const AppError = require("../utils/AppError");
const APIFeatures = require("../utils/apiFeatures");

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];

const slotEnd = (start, durationMinutes) =>
  new Date(start.getTime() + durationMinutes * 60 * 1000);

const hasOverlap = async ({ doctorId, date, duration, excludeId }) => {
  const start = new Date(date);
  const end = slotEnd(start, duration);

  const filter = {
    doctorId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    date: { $lt: end },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const candidates = await Appointment.find(filter);

  return candidates.some((apt) => slotEnd(apt.date, apt.duration) > start);
};

const assertNoConflict = async (payload, excludeId) => {
  const overlap = await hasOverlap({ ...payload, excludeId });
  if (overlap) {
    throw new AppError("This time slot overlaps an existing appointment for that doctor", 409);
  }
};

// @desc    List appointments (admin)
// @route   GET /api/v1/appointments
// @access  Admin

exports.getAllAppointments = catchAsync(async (req, res, next) => {
  const baseQuery = Appointment.find();
  const features = new APIFeatures(baseQuery, req.query)
    .filter()
    .sort()
    .fields()
    .paginate();

  if (!req.query.fields) {
    features.query.select("+adminNotes");
  }

  const appointments = await features.query
    .populate({ path: "patientId", select: "name email phone" })
    .populate({ path: "doctorId", select: "name email specialization" });

  res.status(200).json({
    status: "success",
    results: appointments.length,
    data: { appointments },
  });
});

// @desc    Current patient's appointments
// @route   GET /api/v1/appointments/me
// @access  Patient

exports.getMyAppointments = catchAsync(async (req, res, next) => {
  const appointments = await Appointment.find({ patientId: req.user.id })
    .sort({ date: -1 })
    .select("-__v")
    .populate({ path: "doctorId", select: "name email specialization avatarUrl" });

  res.status(200).json({
    status: "success",
    results: appointments.length,
    data: { appointments },
  });
});

// @desc    Get one appointment
// @route   GET /api/v1/appointments/:id
// @access  Admin, Patient (own)

exports.getAppointmentById = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError("Invalid appointment id", 400));
  }

  let query = Appointment.findById(req.params.id)
    .populate({ path: "patientId", select: "name email phone dateOfBirth" })
    .populate({ path: "doctorId", select: "name email specialization avatarUrl workingHours slotDuration" });

  if (req.user.role === "admin") {
    query = query.select("+adminNotes");
  }

  const appointment = await query;

  if (!appointment) {
    return next(new AppError("No appointment found with that ID", 404));
  }

  const ownerId = appointment.patientId.id || appointment.patientId._id || appointment.patientId;
  if (req.user.role !== "admin" && ownerId.toString() !== req.user.id) {
    return next(new AppError("You are not allowed to access this appointment", 403));
  }

  res.status(200).json({
    status: "success",
    data: { appointment },
  });
});

// @desc    Create appointment
// @route   POST /api/v1/appointments
// @access  Patient

exports.createAppointment = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findOne({ _id: req.body.doctorId, isActive: true });
  if (!doctor) {
    return next(new AppError("No active doctor found with that ID", 404));
  }

  await assertNoConflict({
    doctorId: req.body.doctorId,
    date: req.body.date,
    duration: req.body.duration ?? 30,
  });

  const appointment = await Appointment.create({
    patientId: req.user.id,
    doctorId: req.body.doctorId,
    date: req.body.date,
    duration: req.body.duration,
    notes: req.body.notes || null,
  });

  const populated = await Appointment.findById(appointment._id)
    .populate({ path: "doctorId", select: "name email specialization" });

  res.status(201).json({
    status: "success",
    data: { appointment: populated },
  });
});

// @desc    Update appointment
// @route   PATCH /api/v1/appointments/:id
// @access  Admin, Patient (own; limited fields)

exports.updateAppointment = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError("Invalid appointment id", 400));
  }

  const appointment = await Appointment.findById(req.params.id).select("+adminNotes");
  if (!appointment) {
    return next(new AppError("No appointment found with that ID", 404));
  }

  const isAdmin = req.user.role === "admin";
  const isOwner = appointment.patientId.toString() === req.user.id;

  if (!isAdmin && !isOwner) {
    return next(new AppError("You are not allowed to update this appointment", 403));
  }

  const { date, duration, notes, status, adminNotes, notificationSent } = req.body;

  if (isAdmin) {
    if (date !== undefined) appointment.date = date;
    if (duration !== undefined) appointment.duration = duration;
    if (notes !== undefined) appointment.notes = notes;
    if (status !== undefined) appointment.status = status;
    if (adminNotes !== undefined) appointment.adminNotes = adminNotes;
    if (notificationSent !== undefined) appointment.notificationSent = notificationSent;

    if (appointment.isModified("date") || appointment.isModified("duration")) {
      if (ACTIVE_BOOKING_STATUSES.includes(appointment.status)) {
        await assertNoConflict(
          {
            doctorId: appointment.doctorId,
            date: appointment.date,
            duration: appointment.duration,
          },
          appointment._id,
        );
      }
    }
  } else {
    if (status !== undefined || adminNotes !== undefined || notificationSent !== undefined) {
      return next(new AppError("You cannot update those fields", 403));
    }

    if (appointment.status !== "pending") {
      return next(new AppError("Only pending appointments can be updated by the patient", 400));
    }

    if (date !== undefined) appointment.date = date;
    if (duration !== undefined) appointment.duration = duration;
    if (notes !== undefined) appointment.notes = notes;

    if (appointment.isModified("date") || appointment.isModified("duration")) {
      await assertNoConflict(
        {
          doctorId: appointment.doctorId,
          date: appointment.date,
          duration: appointment.duration,
        },
        appointment._id,
      );
    }
  }

  const doctor = await Doctor.findById(appointment.doctorId);
  if (!doctor || !doctor.isActive) {
    return next(new AppError("Doctor is no longer available", 400));
  }

  await appointment.save();

  let q = Appointment.findById(appointment._id)
    .populate({ path: "patientId", select: "name email phone" })
    .populate({ path: "doctorId", select: "name email specialization" });
  if (isAdmin) q = q.select("+adminNotes");
  const out = await q;

  res.status(200).json({
    status: "success",
    data: { appointment: out },
  });
});

// @desc    Cancel appointment
// @route   PATCH /api/v1/appointments/:id/cancel
// @access  Admin, Patient (own)

exports.cancelAppointment = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError("Invalid appointment id", 400));
  }

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    return next(new AppError("No appointment found with that ID", 404));
  }

  const isAdmin = req.user.role === "admin";
  const isOwner = appointment.patientId.toString() === req.user.id;

  if (!isAdmin && !isOwner) {
    return next(new AppError("You are not allowed to cancel this appointment", 403));
  }

  if (["cancelled", "completed"].includes(appointment.status)) {
    return next(new AppError("This appointment cannot be cancelled", 400));
  }

  appointment.status = "cancelled";
  appointment.cancelReason = req.body.cancelReason || null;
  await appointment.save();

  const populated = await Appointment.findById(appointment._id)
    .populate({ path: "patientId", select: "name email phone" })
    .populate({ path: "doctorId", select: "name email specialization" });

  res.status(200).json({
    status: "success",
    data: { appointment: populated },
  });
});

// @desc    Delete appointment
// @route   DELETE /api/v1/appointments/:id
// @access  Admin

exports.deleteAppointment = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError("Invalid appointment id", 400));
  }

  const appointment = await Appointment.findByIdAndDelete(req.params.id);
  if (!appointment) {
    return next(new AppError("No appointment found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Appointment deleted",
    data: null,
  });
});
