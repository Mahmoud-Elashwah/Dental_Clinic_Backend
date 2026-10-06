const express = require("express");
const passport = require("../config/passport");
const crypto = require("crypto");
const AppError = require("../utils/AppError");
const router = express.Router();
const oauthController = require("../controllers/oauth.controller");

const frontendUrl = () =>
  process.env.FRONTEND_URL ||
  (process.env.CORS_ORIGIN || "http://localhost:5173").split(",")[0].trim();

const requireGoogleOAuth = (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return next(new AppError("Google OAuth is not configured.", 503));
  }
  next();
};

router.get("/google", requireGoogleOAuth, (req, res, next) => {
  const state = crypto.randomBytes(32).toString("hex");
  res.cookie("oauthState", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 10 * 60 * 1000,
  });

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state,
    prompt: "select_account",
  })(req, res, next);
});

const verifyOAuthState = (req, res, next) => {
  const expected = req.cookies?.oauthState;
  const received = req.query.state;
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };
  res.clearCookie("oauthState", options);

  if (
    typeof expected !== "string" ||
    typeof received !== "string" ||
    expected.length !== received.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  ) {
    return next(new AppError("Invalid OAuth state. Please try again.", 401));
  }
  next();
};

router.get(
  "/google/callback",
  requireGoogleOAuth,
  verifyOAuthState,
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${frontendUrl()}/login?oauthError=1`,
  }),
  oauthController.googleCallback,
);
module.exports = router;
