const User = require("../models/Users");
const crypto = require("crypto");
const catchAsync = require("../utils/CatchAsync");
const AppError = require("../utils/AppError");
const authController = require("./auth.controller");

const frontendUrl = () =>
  process.env.FRONTEND_URL ||
  (process.env.CORS_ORIGIN || "http://localhost:5173").split(",")[0].trim();

exports.googleCallback = catchAsync(async (req, res, next) => {
  const profile = req.user?.profile;
  const email = profile?.emails?.[0]?.value?.toLowerCase();
  const emailVerified = profile?.emails?.[0]?.verified === true;
  if (!email || !emailVerified) {
    return next(
      new AppError("Google account does not provide a verified email.", 401),
    );
  }

  let user = await User.findOne({ email }).select("+tokenVersion");
  if (!user) {
    user = await User.create({
      email,
      name: profile.displayName || email.split("@")[0],
      avatarUrl: profile.photos?.[0]?.value || "",
      password: crypto.randomBytes(32).toString("hex"),
      role: "patient",
    });
  }

  if (!user.isActive) {
    return next(new AppError("This account is inactive.", 401));
  }

  const tokens = authController.issueTokenPair(
    user._id,
    user.tokenVersion || 0,
  );
  await authController.storeRefreshToken(user._id, tokens.refreshToken);
  authController.setTokenCookies(res, tokens);

  return res.redirect(new URL("/oauth-success", frontendUrl()).toString());
});
