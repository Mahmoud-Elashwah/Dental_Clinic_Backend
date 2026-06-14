const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { validate } = require("../middleware/validate.middleware");
const { userValidation } = require("../validation/user.validation");

router.route("/register").post(validate(userValidation), authController.register);

router.route("/login").post(authController.login);

router.route("/logout").post(authController.protect, authController.logout);

router.route("/forgot-password").post(authController.forgotPassword);

router.route("/verify-otp").post(authController.verifyOTP);

router.route("/reset-password/:resetToken").patch(authController.resetPassword);

router.route("/change-password").patch(authController.protect, authController.changePassword);

router.route("/refresh-token").post(authController.createRefreshToken);

router.route("/profile").get(authController.protect, authController.getMe);

module.exports = router;
