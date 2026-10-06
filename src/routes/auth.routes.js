const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const {
  validate,
  validateBody,
  validateParams,
} = require("../middleware/validate.middleware");
const { userValidation } = require("../validation/user.validation");
const {
  loginValidation,
  forgotPasswordValidation,
  verifyOtpValidation,
  passwordValidation,
  changePasswordValidation,
  refreshTokenValidation,
  resetTokenParamsValidation,
} = require("../validation/auth.validation");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message:
      "Too many authentication attempts. Please wait a few minutes and try again.",
  },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message:
      "Too many password reset attempts. Please wait before trying again.",
  },
});

router
  .route("/register")
  .post(authLimiter, validate(userValidation), authController.register);

router
  .route("/login")
  .post(authLimiter, validateBody(loginValidation), authController.login);
router.route("/logout").post(authController.protect, authController.logout);
router
  .route("/forgot-password")
  .post(
    resetLimiter,
    validateBody(forgotPasswordValidation),
    authController.forgotPassword,
  );
router
  .route("/verify-otp")
  .post(
    resetLimiter,
    validateBody(verifyOtpValidation),
    authController.verifyOTP,
  );
router
  .route("/reset-password/:resetToken")
  .patch(
    resetLimiter,
    validateParams(resetTokenParamsValidation),
    validateBody(passwordValidation),
    authController.resetPassword,
  );
router
  .route("/change-password")
  .patch(
    authController.protect,
    validateBody(changePasswordValidation),
    authController.changePassword,
  );
router
  .route("/refresh-token")
  .post(
    authLimiter,
    validateBody(refreshTokenValidation),
    authController.createRefreshToken,
  );
router.route("/profile").get(authController.protect, authController.getMe);

module.exports = router;
