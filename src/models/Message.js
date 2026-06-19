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
      enum: ["patient", "doctor"],
      required: true,
    },

    content: {
      type: String,
      maxlength: 2000,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    fileData: {
      type: String, // Base64 string
    },
    fileName: {
      type: String,
    },
    fileType: {
      type: String, // MIME type like image/png, application/pdf
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

messageSchema.index({ chatId: 1, createdAt: -1 });

messageSchema.post("save", async function (doc) {
  const isPatientSender = doc.senderRole === "patient";

  await Chat.findByIdAndUpdate(doc.chatId, {
    lastMessage: doc.content.slice(0, 60) + (doc.content.length > 60 ? "..." : ""),
    lastMessageAt: doc.createdAt,
    lastMessageSenderRole: doc.senderRole,
    $inc: isPatientSender 
      ? { unreadByDoctor: 1 } 
      : { unreadByPatient: 1 },
  });
});

module.exports = mongoose.model("Message", messageSchema);
