const Doctor = require("../models/Doctor");
const catchAsync = require("../utils/CatchAsync");
const AppError = require("../utils/AppError");


// Helper: map a JS Date to a workingHours key

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Convert an "HH:MM" string to total minutes since midnight.
 * @param {string} timeStr - e.g. "09:00"
 * @returns {number}
 */
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Convert total minutes to an "HH:MM" string.
 * @param {number} mins
 * @returns {string}
 */
const minutesToTime = (mins) => {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
};


// @desc    Get all active doctors
// @route   GET /api/v1/doctors
// @access  Public

exports.getAllDoctors = catchAsync(async (req, res, next) => {
  // Optional query filters
  const filter = { isActive: true };

  if (req.query.specialization) {
    filter.specialization = req.query.specialization;
  }

  const doctors = await Doctor.find(filter).select("-__v");

  res.status(200).json({
    status: "success",
    results: doctors.length,
    data: { doctors },
  });
});


// @desc    Get a single doctor by ID
// @route   GET /api/v1/doctors/:id
// @access  Public

exports.getDoctorById = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findById(req.params.id).select("-__v");

  if (!doctor) {
    return next(new AppError("No doctor found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: { doctor },
  });
});


// @desc    Get available time slots for a doctor on a given date
// @route   GET /api/v1/doctors/:id/availability?date=YYYY-MM-DD
// @access  Public

exports.getAvailability = catchAsync(async (req, res, next) => {
  const { date } = req.query;

  // 1) Validate date parameter
  if (!date) {
    return next(
      new AppError("Please provide a date query parameter (YYYY-MM-DD)", 400),
    );
  }

  const requestedDate = new Date(date);
  if (isNaN(requestedDate.getTime())) {
    return next(new AppError("Invalid date format. Use YYYY-MM-DD", 400));
  }

  // 2) Find the doctor
  const doctor = await Doctor.findOne({
    _id: req.params.id,
    isActive: true,
  });

  if (!doctor) {
    return next(new AppError("No active doctor found with that ID", 404));
  }

  // 3) Determine the day key (sun=0 … sat=6)
  const dayKey = DAY_KEYS[requestedDate.getDay()];
  const daySchedule = doctor.workingHours[dayKey];

  // 4) If the doctor is off that day, return empty slots
  if (!daySchedule || daySchedule.isOff) {
    return res.status(200).json({
      status: "success",
      data: {
        doctor: doctor.name,
        date,
        dayOfWeek: dayKey,
        isOff: true,
        slots: [],
      },
    });
  }

  // 5) Generate time slots
  const startMinutes = timeToMinutes(daySchedule.start);
  const endMinutes = timeToMinutes(daySchedule.end);
  const { slotDuration } = doctor;
  const slots = [];

  for (let t = startMinutes; t + slotDuration <= endMinutes; t += slotDuration) {
    slots.push({
      start: minutesToTime(t),
      end: minutesToTime(t + slotDuration),
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      doctor: doctor.name,
      date,
      dayOfWeek: dayKey,
      isOff: false,
      slotDuration,
      totalSlots: slots.length,
      slots,
    },
  });
});


// @desc    Add a new doctor
// @route   POST /api/v1/doctors
// @access  Admin

exports.addDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.create(req.body);

  res.status(201).json({
    status: "success",
    data: { doctor },
  });
});


// @desc    Update an existing doctor
// @route   PATCH /api/v1/doctors/:id
// @access  Admin

exports.updateDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!doctor) {
    return next(new AppError("No doctor found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: { doctor },
  });
});


// @desc    Soft-delete a doctor (set isActive to false)
// @route   DELETE /api/v1/doctors/:id
// @access  Admin

exports.deleteDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true },
  );

  if (!doctor) {
    return next(new AppError("No doctor found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Doctor has been deactivated (soft deleted)",
    data: null,
  });
});
