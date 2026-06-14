const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

let url;
if (process.env.NODE_ENV === "development") {
  url = "http://localhost:3000";
} else if (process.env.NODE_ENV === "production") {
  url = "https://dentalclinicbackend-production.up.railway.app";
} else {
  url = "http://localhost:3000";
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${url}/api/v1/oauth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = {
          accessToken,
          refreshToken,
          profile,
        };
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

module.exports = passport;
