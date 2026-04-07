const mongoose = require("mongoose");
const Chat = require("./Chat");

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    senderRole: {
      type: String,
      enum: ["patient", "admin"],
      required: true,
    },

    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

messageSchema.index({ chatId: 1, createdAt: -1 });

// 🔥 Post-save hook
messageSchema.post("save", async function (doc) {
  const isPatient = doc.senderRole === "patient";

  await Chat.findByIdAndUpdate(doc.chatId, {
    lastMessage: doc.content.slice(0, 60),
    lastMessageAt: doc.createdAt,
    $inc: isPatient ? { unreadByAdmin: 1 } : { unreadByPatient: 1 },
  });
});

module.exports = mongoose.model("Message", messageSchema);
