const express = require("express");
const cookieParser = require("cookie-parser");
const AppError = require('./utils/AppError');
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());

// Middleware to parse cookies
app.use(cookieParser());

// Importing routes 
const authRoutes = require("./routes/auth.routes");
const doctorRoutes = require("./routes/doctor.routes");
const globalErrorHandler = require("./middleware/error.middleware");


// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/doctors", doctorRoutes);

// Handle undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
 
 
// Global error handling middleware
app.use(globalErrorHandler);




module.exports = app;
