const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

require("dotenv").config();

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const backendUrl =
    process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${backendUrl}/api/v1/oauth/google/callback`,
      },
      (accessToken, refreshToken, profile, done) => done(null, { profile }),
    ),
  );
}

module.exports = passport;
