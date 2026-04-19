const express = require("express");
const cookieParser = require("cookie-parser");
const AppError = require("./utils/AppError");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());

// Middleware to parse cookies
app.use(cookieParser());

// Importing routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const doctorRoutes = require("./routes/doctor.routes");
const massageRoutes = require("./routes/message.routes");
const chatRoutes = require("./routes/chat.routes");
const appointmentRoutes = require("./routes/appointment.routes");
const globalErrorHandler = require("./middleware/error.middleware");

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/doctors", doctorRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/messages", massageRoutes);
app.use("/api/v1/appointments", appointmentRoutes);

// Handle undefined routes
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(globalErrorHandler);

module.exports = app;
