const Joi = require("joi");

// Reusable time pattern (HH:MM, 24-hour)
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Allowed specializations (mirrors Mongoose enum)
const specializations = [
  "General Dentistry",
  "Orthodontics",
  "Endodontics",
  "Periodontics",
  "Prosthodontics",
  "Oral Surgery",
  "Pediatric Dentistry",
  "Cosmetic Dentistry",
];

// Sub-schema for a single day's schedule
const daySchedule = Joi.object({
  start: Joi.string().pattern(timePattern).messages({
    "string.pattern.base": "Start time must be in HH:MM format (24h)",
  }),
  end: Joi.string().pattern(timePattern).messages({
    "string.pattern.base": "End time must be in HH:MM format (24h)",
  }),
  isOff: Joi.boolean(),
});

// Working hours object (mon–sun)
const workingHoursSchema = Joi.object({
  mon: daySchedule,
  tue: daySchedule,
  wed: daySchedule,
  thu: daySchedule,
  fri: daySchedule,
  sat: daySchedule,
  sun: daySchedule,
});


// Validation: Add Doctor (POST)

exports.addDoctorValidation = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "Doctor name is required",
  }),

  email: Joi.string().email().lowercase().required().messages({
    "any.required": "Doctor email is required",
    "string.email": "Please provide a valid email address",
  }),

  specialization: Joi.string()
    .valid(...specializations)
    .required()
    .messages({
      "any.required": "Specialization is required",
      "any.only": `Specialization must be one of: ${specializations.join(", ")}`,
    }),

  bio: Joi.string().max(500).allow("").messages({
    "string.max": "Bio cannot exceed 500 characters",
  }),

  avatarUrl: Joi.string().uri().allow("").messages({
    "string.uri": "Avatar URL must be a valid URI",
  }),

  workingHours: workingHoursSchema,

  slotDuration: Joi.number().integer().min(15).max(120).messages({
    "number.min": "Slot duration must be at least 15 minutes",
    "number.max": "Slot duration cannot exceed 120 minutes",
  }),
});


// Validation: Update Doctor (PATCH)
// All fields optional for partial updates

exports.updateDoctorValidation = Joi.object({
  name: Joi.string().trim().messages({
    "string.base": "Name must be a string",
  }),

  email: Joi.string().email().lowercase().messages({
    "string.email": "Please provide a valid email address",
  }),

  specialization: Joi.string()
    .valid(...specializations)
    .messages({
      "any.only": `Specialization must be one of: ${specializations.join(", ")}`,
    }),

  bio: Joi.string().max(500).allow("").messages({
    "string.max": "Bio cannot exceed 500 characters",
  }),

  avatarUrl: Joi.string().uri().allow("").messages({
    "string.uri": "Avatar URL must be a valid URI",
  }),

  workingHours: workingHoursSchema,

  slotDuration: Joi.number().integer().min(15).max(120).messages({
    "number.min": "Slot duration must be at least 15 minutes",
    "number.max": "Slot duration cannot exceed 120 minutes",
  }),

  isActive: Joi.boolean(),
});
