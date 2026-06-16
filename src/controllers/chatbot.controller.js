const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const catchAsync = require("../utils/CatchAsync");
const AppError = require("../utils/AppError");
const chatbotService = require("../services/chatbot.service");
const User = require("../models/Users");

const getUserFromToken = async (req) => {
  const authHeader = req.headers.authorization || "";
  const token = req.cookies?.jwt || (authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null);
  if (!token) return null;

  try {
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    return user || null;
  } catch (err) {
    return null;
  }
};

const getSessionKey = (req, user) => {
  if (user && user.id) return `user:${user.id}`;
  return `guest:${req.ip || req.socket.remoteAddress || "anonymous"}`;
};

exports.chat = catchAsync(async (req, res, next) => {
  const userMessage = String(req.body.message || "").trim();
  if (!userMessage) {
    return next(new AppError("Request body must include a non-empty 'message' field.", 400));
  }

  const user = await getUserFromToken(req);
  const sessionKey = getSessionKey(req, user);

  const response = await chatbotService.handleUserMessage(userMessage, {
    sessionKey,
    user,
  });

  return res.status(200).json(response);
});
