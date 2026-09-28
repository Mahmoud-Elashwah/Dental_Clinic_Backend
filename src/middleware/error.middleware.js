const AppError = require("../utils/AppError");

const normalizeError = (error) => {
  if (error.name === "CastError") {
    return new AppError(`Invalid ${error.path}.`, 400);
  }
  if (error.code === 11000) {
    return new AppError("A record with that value already exists.", 409);
  }
  if (error.name === "ValidationError") {
    return new AppError("Invalid input data.", 400);
  }
  if (error.name === "JsonWebTokenError") {
    return new AppError("Invalid token. Please log in again.", 401);
  }
  if (error.name === "TokenExpiredError") {
    return new AppError("Your token has expired. Please log in again.", 401);
  }
  if (error.type === "entity.parse.failed") {
    return new AppError("Request body contains invalid JSON.", 400);
  }
  if (error.type === "entity.too.large") {
    return new AppError("Request body is too large.", 413);
  }
  if (
    error.name === "MongoServerSelectionError" ||
    error.name === "MongoNetworkError"
  ) {
    return new AppError("Database service is temporarily unavailable.", 503);
  }
  if (error.message === "Not allowed by CORS") {
    return new AppError("Origin is not allowed by CORS.", 403);
  }
  return error;
};

module.exports = (err, req, res, next) => {
  const error = normalizeError(err);
  const statusCode = Number(error.statusCode || error.status) || 500;
  const status = statusCode >= 500 ? "error" : "fail";
  const isDevelopment = process.env.NODE_ENV === "development";

  if (statusCode >= 500 && !error.isOperational) {
    console.error("Unhandled request error", {
      name: error.name,
      code: error.code,
    });
  }

  const response = {
    status: error.status || status,
    message:
      error.isOperational || isDevelopment
        ? error.message
        : "An unexpected error occurred.",
  };

  if (req.requestId) response.requestId = req.requestId;
  if (isDevelopment) response.stack = error.stack;

  res.status(statusCode).json(response);
};
