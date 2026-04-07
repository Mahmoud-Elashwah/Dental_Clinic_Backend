const Chat = require("../models/Chat");
const catchAsync = require("../utils/CatchAsync");
const AppError = require("../utils/AppError");

// =========================
// 🔹 Chats
// =========================

// create chat (patient)
exports.createChat = catchAsync(async (req, res, next) => {
  const existing = await Chat.findOne({ patientId: req.user.id });

  if (existing) {
    return res.status(200).json({
      status: "success",
      data: existing,
    });
  }

  const chat = await Chat.create({
    patientId: req.user.id,
  });

  res.status(201).json({
    status: "success",
    data: chat,
  });
});

// get all chats
exports.getChats = catchAsync(async (req, res, next) => {
  let chats;

  if (req.user.role === "admin") {
    chats = await Chat.find().sort({ lastMessageAt: -1 });
  } else {
    chats = await Chat.find({ patientId: req.user.id });
  }

  res.status(200).json({
    status: "success",
    results: chats.length,
    data: chats,
  });
});

// get single chat
exports.getChat = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id);

  if (!chat) {
    return next(new AppError("Chat not found", 404));
  }

  if (req.user.role !== "admin" && chat.patientId.toString() !== req.user.id) {
    return next(new AppError("Not allowed", 403));
  }

  res.status(200).json({
    status: "success",
    data: chat,
  });
});
