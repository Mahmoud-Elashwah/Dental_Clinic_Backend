const Joi = require("joi");
const { paginationFields, paramsWithIds } = require("./common.validation");
const { workingHoursSchema } = require("./doctor.validation");

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

const userValidation = Joi.object({
  name: Joi.string().trim().max(100).required().messages({
    "string.base": "name must be string",
    "string.empty": "name is required",
  }),

  email: Joi.string().trim().email().lowercase().max(254).required().messages({
    "string.email": "Please provide a valid email",
    "string.empty": "Email is required",
  }),

  password: Joi.string().min(8).max(128).required().messages({
    "string.min": "Password must be at least 8 characters",
    "string.empty": "Password is required",
  }),

  phone: Joi.string().trim().max(32).optional().messages({
    "string.base": "Please provide a valid phone number",
  }),

  dateOfBirth: Joi.date().max("now").optional().messages({
    "date.base": "Please provide a valid date of birth",
  }),
}).unknown(false);

module.exports = {
  userValidation,
};

module.exports.userParamsValidation = paramsWithIds("id");
module.exports.userListQueryValidation = Joi.object({
  ...paginationFields,
  sort: Joi.string()
    .max(100)
    .pattern(/^[A-Za-z0-9_., -]+$/),
  role: Joi.string().valid("admin", "patient", "doctor"),
  name: Joi.string().trim().max(100),
  email: Joi.string().trim().email().lowercase().max(254),
  isActive: Joi.boolean(),
}).unknown(false);

module.exports.updateUserValidation = Joi.object({
  name: Joi.string().trim().max(100),
  phone: Joi.string().trim().max(32),
  dateOfBirth: Joi.date().max("now"),
  bio: Joi.string().trim().max(500).allow(""),
  avatarUrl: Joi.string().uri().allow(""),
  specialization: Joi.string().valid(...specializations),
  workingHours: workingHoursSchema,
  slotDuration: Joi.number().integer().min(15).max(120).multiple(15),
})
  .min(1)
  .unknown(false);
