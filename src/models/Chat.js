const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    lastMessage: {
      type: String,
      maxlength: 60,
      default: null,
    },

    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },

    isOpen: {
      type: Boolean,
      default: true,
    },

    unreadByAdmin: {
      type: Number,
      default: 0,
    },

    unreadByPatient: {
      type: Number,
      default: 0,
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastMessageSenderRole: { type: String, enum: ["patient", "admin"] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

module.exports = mongoose.model("Chat", chatSchema);
