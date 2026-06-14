const Review = require("../models/Review");
const Appointment = require("../models/Appointment");
const catchAsync = require("../utils/CatchAsync");
const AppError = require("../utils/AppError");

// @desc    Add a review
// @route   POST /api/v1/reviews
// @access  Protected (Patient only)
exports.addReview = catchAsync(async (req, res, next) => {
  const { doctorId, rating, comment } = req.body;
  const patientId = req.user._id;

  // 1. Check if patient has a "completed" appointment with this doctor
  const completedAppointment = await Appointment.findOne({
    patientId,
    doctorId,
    status: "completed",
  });

  if (!completedAppointment) {
    return next(
      new AppError("You can only review a doctor after a completed appointment.", 403)
    );
  }

  // 2. Check if the patient already reviewed this doctor
  const existingReview = await Review.findOne({ patientId, doctorId });
  if (existingReview) {
    return next(new AppError("You have already reviewed this doctor.", 400));
  }

  // 3. Create the review
  const review = await Review.create({
    patientId,
    doctorId,
    rating,
    comment,
  });

  res.status(201).json({
    status: "success",
    data: { review },
  });
});

// @desc    Get all reviews for a specific doctor
// @route   GET /api/v1/reviews/doctor/:doctorId
// @access  Public
exports.getDoctorReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find({ doctorId: req.params.doctorId }).sort({ createdAt: -1 });

  // Calculate average rating
  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews).toFixed(1)
      : 0;

  res.status(200).json({
    status: "success",
    results: totalReviews,
    data: {
      averageRating: parseFloat(averageRating),
      reviews,
    },
  });
});
