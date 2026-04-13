const Chat = require("../models/Chat");
const catchAsync = require("../utils/CatchAsync");
const AppError = require("../utils/AppError");
const Message = require("../models/Message");

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

// mark chat as read
exports.markChatAsRead = catchAsync(async (req, res, next) => {
  const { chatId } = req.params;
  const userRole = req.user.role;

  const chat = await Chat.findById(chatId);

  if (!chat) {
    return next(new AppError("Chat not found", 404));
  }

  if (req.user.role !== "admin" && chat.patientId.toString() !== req.user.id) {
    return next(new AppError("Not allowed", 403));
  }

  const updateField =
    userRole === "patient" ? { unreadByPatient: 0 } : { unreadByAdmin: 0 };

  await Chat.findByIdAndUpdate(chatId, updateField);

  // اختياري: mark all messages as read
  await Message.updateMany(
    { chatId, senderRole: { $ne: userRole }, isRead: false },
    { isRead: true },
  );

  // Emit real-time update to the chat room
  const io = req.app.get("io");
  io.to(chatId).emit("messagesSeen", { chatId });

  res.status(200).json({ status: "success", message: "Chat marked as read" });
});
