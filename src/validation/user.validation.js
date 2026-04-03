const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

const userValidation = Joi.object({

name: Joi.string().required().messages({
    "string.base": "name must be string",
    "string.empty": "name is required",
  }),

  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email",
    "string.empty": "Email is required",
  }),

  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters",
    "string.empty": "Password is required",
  }),

  role: Joi.string().valid("admin", "patient").default("patient").messages({
    "string.base": "Role must be a string",
    "any.only": "Role must be either 'admin' or 'patient'",
  }),

  phone: Joi.string().optional().messages({
    "string.base": "Please provide a valid phone number",
  }),

  dateOfBirth: Joi.date().optional().messages({
    "date.base": "Please provide a valid date of birth",
  }),

});

module.exports = {
  userValidation,
};