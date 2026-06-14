const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Review must belong to a patient"],
    },
    doctorId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Review must belong to a doctor"],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: [true, "Review must have a rating between 1 and 5"],
    },
    comment: {
      type: String,
      required: [true, "Review must have a comment"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate reviews: 1 review per patient per doctor
reviewSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });

// Auto-populate patient details when fetching reviews
reviewSchema.pre(/^find/, async function () {
  this.populate({
    path: "patientId",
    select: "name avatarUrl",
  });
});

module.exports = mongoose.model("Review", reviewSchema);
