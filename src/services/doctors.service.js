const mongoose = require("mongoose");
const User = require("../models/Users");
const Review = require("../models/Review");
const AppError = require("../utils/AppError");

const buildDoctorPayload = (doctor, averageRating, reviewCount) => ({
  id: doctor._id,
  name: doctor.name,
  email: doctor.email,
  specialization: doctor.specialization,
  bio: doctor.bio,
  avatarUrl: doctor.avatarUrl,
  isActive: doctor.isActive,
  averageRating,
  reviewCount,
});

exports.findDoctors = async ({ specialization } = {}) => {
  const filter = { role: "doctor" };
  if (specialization) filter.specialization = specialization;

  const doctors = await User.find(filter).select("-password").lean();

  return Promise.all(
    doctors.map(async (doctor) => {
      const reviews = await Review.find({ doctorId: doctor._id }).lean();
      const reviewCount = reviews.length;
      const averageRating =
        reviewCount > 0
          ? Number((reviews.reduce((sum, item) => sum + item.rating, 0) / reviewCount).toFixed(1))
          : 0;
      return buildDoctorPayload(doctor, averageRating, reviewCount);
    }),
  );
};

exports.getDoctorById = async (doctorId) => {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    throw new AppError("Invalid doctor id", 400);
  }

  const doctor = await User.findOne({ _id: doctorId, role: "doctor" }).select("-password").lean();
  if (!doctor) {
    throw new AppError("Doctor not found", 404);
  }

  const reviews = await Review.find({ doctorId: doctor._id }).lean();
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0
      ? Number((reviews.reduce((sum, item) => sum + item.rating, 0) / reviewCount).toFixed(1))
      : 0;

  return buildDoctorPayload(doctor, averageRating, reviewCount);
};
