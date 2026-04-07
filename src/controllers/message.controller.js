const catchAsync = require("../utils/CatchAsync");
const appError = require("../utils/AppError");
const Message = require("../models/Message");

exports.sendMessage = catchAsync(async (req, res, next) => {
  const { chatId, content } = req.body;

  const message = await Message.create({
    chatId,
    senderId: req.user.id,
    senderRole: req.user.role,
    content,
  });

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

// mark message as read
exports.markMessageAsRead = catchAsync(async (req, res, next) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return next(new AppError("Message not found", 404));
  }

  if (!message.isRead) {
    message.isRead = true;
    await message.save();

    const isPatient = message.senderRole === "patient";

    await Chat.findByIdAndUpdate(message.chatId, {
      $inc: isPatient ? { unreadByAdmin: -1 } : { unreadByPatient: -1 },
    });
  }

  res.status(200).json({
    status: "success",
    message: "Message marked as read",
  });
});
