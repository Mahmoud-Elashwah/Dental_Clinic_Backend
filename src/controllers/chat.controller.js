const Chat = require("../models/Chat");
const catchAsync = require("../utils/CatchAsync");
const AppError = require("../utils/AppError");
const Message = require("../models/Message");
const User = require("../models/Users");

// =========================
// 🔹 Chats
// =========================

// create chat (patient)
exports.createChat = catchAsync(async (req, res, next) => {
  const { doctorId } = req.body;

  if (!doctorId) {
    return next(new AppError("Please provide a doctorId", 400));
  }

  // Ensure doctor exists and is a doctor
  const doctor = await User.findById(doctorId);
  if (!doctor || doctor.role !== "doctor") {
    return next(new AppError("Doctor not found", 404));
  }

  const existing = await Chat.findOne({ patientId: req.user.id, doctorId });

  if (existing) {
    return res.status(200).json({
      status: "success",
      data: existing,
    });
  }

  const chat = await Chat.create({
    patientId: req.user.id,
    doctorId,
  });

  res.status(201).json({
    status: "success",
    data: chat,
  });
});

// get all chats
exports.getChats = catchAsync(async (req, res, next) => {
  let chats;

  if (req.user.role === "doctor") {
    chats = await Chat.find({ doctorId: req.user.id })
      .populate("patientId", "name avatarUrl")
      .sort({ lastMessageAt: -1 });
  } else {
    chats = await Chat.find({ patientId: req.user.id })
      .populate("doctorId", "name avatarUrl")
      .sort({ lastMessageAt: -1 });
  }

  res.status(200).json({
    status: "success",
    results: chats.length,
    data: chats,
  });
});

// get single chat
exports.getChat = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id)
    .populate("patientId", "name avatarUrl")
    .populate("doctorId", "name avatarUrl");

  if (!chat) {
    return next(new AppError("Chat not found", 404));
  }

  if (
    chat.doctorId.toString() !== req.user.id &&
    chat.patientId.toString() !== req.user.id
  ) {
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

  if (
    chat.doctorId.toString() !== req.user.id &&
    chat.patientId.toString() !== req.user.id
  ) {
    return next(new AppError("Not allowed", 403));
  }

  const updateField =
    userRole === "patient" ? { unreadByPatient: 0 } : { unreadByDoctor: 0 };

  await Chat.findByIdAndUpdate(chatId, updateField);

  // mark all messages as read
  await Message.updateMany(
    { chatId, senderRole: { $ne: userRole }, isRead: false },
    { isRead: true },
  );

  // Emit real-time update to the chat room
  const io = req.app.get("io");
  io.to(chatId).emit("messagesSeen", { chatId });

  res.status(200).json({ status: "success", message: "Chat marked as read" });
});
