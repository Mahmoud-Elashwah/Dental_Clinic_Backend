const catchAsync = require("../utils/CatchAsync");
const appError = require("../utils/AppError");
const Message = require("../models/Message");

exports.sendMessage = catchAsync(async (req, res, next) => {
  const { chatId, content, fileData, fileName, fileType } = req.body;

  // Validation + Business logic
  if (!chatId || (!content?.trim() && !fileData)) {
    return next(new appError("Chat ID and content or file are required", 400));
  }

  // verify chat existence and access rights
  const Chat = require("../models/Chat");
  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new appError("Chat not found", 404));
  }

  if (
    chat.doctorId.toString() !== req.user.id &&
    chat.patientId.toString() !== req.user.id
  ) {
    return next(new appError("Not allowed", 403));
  }

  const message = await Message.create({
    chatId,
    senderId: req.user.id,
    senderRole: req.user.role,
    content: content ? content.trim() : "",
    fileData,
    fileName,
    fileType,
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

// Edit message
exports.editMessage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    return next(new appError("Content is required for editing", 400));
  }

  const message = await Message.findById(id);
  if (!message) {
    return next(new appError("Message not found", 404));
  }

  if (message.senderId.toString() !== req.user.id) {
    return next(new appError("Not allowed to edit this message", 403));
  }

  message.content = content.trim();
  message.isEdited = true;
  await message.save();

  const populatedMessage = await Message.findById(message._id).populate("senderId", "name role");

  const io = req.app.get("io");
  if (io) {
    io.to(message.chatId.toString()).emit("messageEdited", populatedMessage);
  }

  res.status(200).json({
    status: "success",
    data: populatedMessage,
  });
});

// Delete message
exports.deleteMessage = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const message = await Message.findById(id);
  if (!message) {
    return next(new appError("Message not found", 404));
  }

  if (message.senderId.toString() !== req.user.id) {
    return next(new appError("Not allowed to delete this message", 403));
  }

  await message.deleteOne();

  const io = req.app.get("io");
  if (io) {
    io.to(message.chatId.toString()).emit("messageDeleted", id);
  }

  res.status(204).json({
    status: "success",
    data: null,
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
