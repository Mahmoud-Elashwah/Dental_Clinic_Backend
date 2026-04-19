const catchAsync = require("../utils/CatchAsync");
const appError = require("../utils/AppError");
const Message = require("../models/Message");

exports.sendMessage = catchAsync(async (req, res, next) => {
  const { chatId, content } = req.body;

  // Validation + Business logic
  if (!chatId || !content?.trim()) {
    return next(new appError("Chat ID and content are required", 400));
  }

  // verify chat existence and access rights
  if (req.user.role !== "admin" && req.user.role !== "patient") {
    return next(new appError("Not allowed", 403));
  }

  const message = await Message.create({
    chatId,
    senderId: req.user.id,
    senderRole: req.user.role,
    content: content.trim(),
  });

  // Populate sender details for response
  const populatedMessage = await Message.findById(message._id).populate(
    "senderId",
    "name role",
  );

  // Emit real-time updates to the chat room
  const io = req.app.get("io");
  if (io) {
    io.to(chatId).emit("newMessage", populatedMessage);
    io.to(chatId).emit("chatUpdated", {
      chatId,
      lastMessage: populatedMessage,
    });
  }

  res.status(201).json({
    status: "success",
    data: message,
  });
});

// get messages (pagination)
exports.getMessages = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;

  const messages = await Message.find({
    chatId: req.params.chatId,
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.status(200).json({
    status: "success",
    results: messages.length,
    data: messages,
  });
});
