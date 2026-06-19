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

exports.findDoctors = async ({ specialization, name } = {}) => {
  const filter = { role: "doctor" };
  if (specialization) filter.specialization = specialization;
  if (name) filter.name = { $regex: name.split(" ").join("|"), $options: "i" };

  const doctors = await User.find(filter).select("-password").lean();

  const doctorIds = doctors.map((d) => d._id);


  const allReviews = await Review.find({ doctorId: { $in: doctorIds } }).lean();

  return doctors.map((doctor) => {
    const reviews = allReviews.filter(
      (r) => r.doctorId.toString() === doctor._id.toString(),
    );
    const reviewCount = reviews.length;
    const averageRating =
      reviewCount > 0
        ? Number(
            (
              reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            ).toFixed(1),
          )
        : 0;
    return buildDoctorPayload(doctor, averageRating, reviewCount);
  });
};

exports.getDoctorById = async (doctorId) => {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    throw new AppError("Invalid doctor id", 400);
  }

  const doctor = await User.findOne({ _id: doctorId, role: "doctor" })
    .select("-password")
    .lean();
  if (!doctor) {
    throw new AppError("Doctor not found", 404);
  }

  const reviews = await Review.find({ doctorId: doctor._id }).lean();
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0
      ? Number(
          (
            reviews.reduce((sum, item) => sum + item.rating, 0) / reviewCount
          ).toFixed(1),
        )
      : 0;

  return buildDoctorPayload(doctor, averageRating, reviewCount);
};
