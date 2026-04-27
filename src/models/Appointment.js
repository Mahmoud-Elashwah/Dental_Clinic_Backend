const mongoose = require("mongoose");

const STATUSES = ["pending", "confirmed", "completed", "cancelled"];

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Patient is required"],
      index: true,
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Doctor is required"],
      index: true,
    },

    date: {
      type: Date,
      required: [true, "Appointment date and time are required"],
      index: true,
    },

    duration: {
      type: Number,
      default: 30,
      min: [15, "Duration must be at least 15 minutes"],
      max: [480, "Duration cannot exceed 480 minutes"],
    },

    status: {
      type: String,
      enum: {
        values: STATUSES,
        message: `Status must be one of: ${STATUSES.join(", ")}`,
      },
      default: "pending",
      index: true,
    },

    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
      default: null,
    },

    adminNotes: {
      type: String,
      maxlength: [1000, "Admin notes cannot exceed 1000 characters"],
      default: null,
      select: false,
    },

    notificationSent: {
      type: Boolean,
      default: false,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelReason: {
      type: String,
      maxlength: [1000, "Cancel reason cannot exceed 1000 characters"],
      default: null,
    },
  },
  {
    collection: "appointments",
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

appointmentSchema.index({ doctorId: 1, date: 1 });

appointmentSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "cancelled" && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
});

appointmentSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model("Appointment", appointmentSchema);
