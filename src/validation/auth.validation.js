const Joi = require("joi");

const email = Joi.string().trim().email().lowercase().max(254).required();
const password = Joi.string().min(8).max(128).required();

exports.loginValidation = Joi.object({
  email,
  password,
}).unknown(false);

exports.forgotPasswordValidation = Joi.object({ email }).unknown(false);

exports.verifyOtpValidation = Joi.object({
  email,
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required(),
}).unknown(false);

exports.passwordValidation = Joi.object({ password }).unknown(false);

exports.changePasswordValidation = Joi.object({
  passwordCurrent: Joi.string().min(1).max(128).required(),
  password,
}).unknown(false);

exports.refreshTokenValidation = Joi.object({
  refreshToken: Joi.string().min(20).max(4096).optional(),
}).unknown(false);

exports.resetTokenParamsValidation = Joi.object({
  resetToken: Joi.string().hex().length(64).required(),
}).unknown(false);
