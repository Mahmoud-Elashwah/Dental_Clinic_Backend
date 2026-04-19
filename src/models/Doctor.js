const mongoose = require("mongoose");
const validator = require("validator");
 
// Specialization enum values 
const SPECIALIZATIONS = [
  "General Dentistry",
  "Orthodontics",
  "Endodontics",
  "Periodontics",
  "Prosthodontics",
  "Oral Surgery",
  "Pediatric Dentistry",
  "Cosmetic Dentistry",
];
 
// Sub-schema a single day's working hours 
const dayScheduleSchema = new mongoose.Schema(
  {
    start: {
      type: String,
      default: "09:00",
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Start time must be in HH:MM format"],
    },
    end: {
      type: String,
      default: "17:00",
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "End time must be in HH:MM format"],
    },
    isOff: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);
 
// Main Doctor schema 
const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Doctor name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Doctor email is required"],
      unique: true,
      lowercase: true,
      index: true,
      validate: [validator.isEmail, "Please provide a valid email address"],
    },

    specialization: {
      type: String,
      required: [true, "Specialization is required"],
      enum: {
        values: SPECIALIZATIONS,
        message: `Specialization must be one of: ${SPECIALIZATIONS.join(", ")}`,
      },
    },

    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },

    avatarUrl: {
      type: String,
      default: "",
    },

    workingHours: {
      mon: { type: dayScheduleSchema, default: () => ({ start: "09:00", end: "17:00", isOff: false }) },
      tue: { type: dayScheduleSchema, default: () => ({ start: "09:00", end: "17:00", isOff: false }) },
      wed: { type: dayScheduleSchema, default: () => ({ start: "09:00", end: "17:00", isOff: false }) },
      thu: { type: dayScheduleSchema, default: () => ({ start: "09:00", end: "17:00", isOff: false }) },
      fri: { type: dayScheduleSchema, default: () => ({ start: "09:00", end: "17:00", isOff: false }) },
      sat: { type: dayScheduleSchema, default: () => ({ start: "09:00", end: "17:00", isOff: true }) },
      sun: { type: dayScheduleSchema, default: () => ({ start: "09:00", end: "17:00", isOff: true }) },
    },

    slotDuration: {
      type: Number,
      default: 30,
      min: [15, "Slot duration must be at least 15 minutes"],
      max: [120, "Slot duration cannot exceed 120 minutes"],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);
 
// Indexes 
doctorSchema.index({ specialization: 1, isActive: 1 });
 
// Static: export allowed specializations 
doctorSchema.statics.SPECIALIZATIONS = SPECIALIZATIONS;

module.exports = mongoose.model("Doctor", doctorSchema);
