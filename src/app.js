require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const { randomUUID } = require("crypto");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./config/swagger");
const AppError = require("./utils/AppError");

const app = express();

app.use((req, res, next) => {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.info("http_request", {
      requestId,
      method: req.method,
      route: req.baseUrl + (req.route?.path || "unmatched"),
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
    });
  });
  next();
});

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  const safeMethod = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  const usesCookieAuthentication = Boolean(
    req.cookies?.jwt || req.cookies?.refreshToken,
  );
  const usesBearerAuthentication = /^Bearer\s+\S+$/i.test(
    req.get("authorization") || "",
  );
  const origin = req.get("origin");

  if (
    !safeMethod &&
    usesCookieAuthentication &&
    !usesBearerAuthentication &&
    (!origin || !allowedOrigins.includes(origin))
  ) {
    return next(
      new AppError(
        "Origin is not allowed for cookie-authenticated requests.",
        403,
      ),
    );
  }
  next();
});
app.use(mongoSanitize());

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests, please try again later.",
  },
});
app.use(generalLimiter);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many API requests, please try again later.",
  },
});

const passport = require("./config/passport");
app.use(passport.initialize());

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const doctorRoutes = require("./routes/doctor.routes");
const messageRoutes = require("./routes/message.routes");
const chatRoutes = require("./routes/chat.routes");
const chatbotRoutes = require("./routes/chatbot.routes");
const appointmentRoutes = require("./routes/appointment.routes");
const aiRoutes = require("./routes/ai.routes");
const oauthRoutes = require("./routes/oauth.routes");
const reviewRoutes = require("./routes/review.routes");
const globalErrorHandler = require("./middleware/error.middleware");

app.get("/health", (req, res) => {
  res.status(200).json({ status: "success", message: "API is healthy" });
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, { explorer: true }),
);
app.use("/api/v1", apiLimiter);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/oauth", oauthRoutes);
app.use("/api/v1/doctors", doctorRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/chatbot", chatbotRoutes);
app.use("/api/v1/ai", aiRoutes);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
