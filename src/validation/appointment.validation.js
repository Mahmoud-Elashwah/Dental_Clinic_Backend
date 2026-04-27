const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = Joi.string()
  .required()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  }, "MongoDB ObjectId validation")
  .messages({
    "any.invalid": "Invalid id format",
  });

const statuses = ["pending", "confirmed", "completed", "cancelled"];

exports.createAppointmentValidation = Joi.object({
  doctorId: objectId,
  date: Joi.date().required().messages({
    "any.required": "Appointment date and time are required",
  }),
  duration: Joi.number().integer().min(15).max(480).messages({
    "number.min": "Duration must be at least 15 minutes",
    "number.max": "Duration cannot exceed 480 minutes",
  }),
  notes: Joi.string().max(1000).allow(null, "").messages({
    "string.max": "Notes cannot exceed 1000 characters",
  }),
});

exports.updateAppointmentValidation = Joi.object({
  date: Joi.date().messages({
    "date.base": "Date must be valid",
  }),
  duration: Joi.number().integer().min(15).max(480).messages({
    "number.min": "Duration must be at least 15 minutes",
    "number.max": "Duration cannot exceed 480 minutes",
  }),
  notes: Joi.string().max(1000).allow(null, "").messages({
    "string.max": "Notes cannot exceed 1000 characters",
  }),
  status: Joi.string()
    .valid(...statuses)
    .messages({
      "any.only": `Status must be one of: ${statuses.join(", ")}`,
    }),
  adminNotes: Joi.string().max(1000).allow(null, "").messages({
    "string.max": "Admin notes cannot exceed 1000 characters",
  }),
  notificationSent: Joi.boolean(),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update",
  });

exports.cancelAppointmentValidation = Joi.object({
  cancelReason: Joi.string().max(1000).allow(null, "").messages({
    "string.max": "Cancel reason cannot exceed 1000 characters",
  }),
});
