const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    doctorId: {
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

    unreadByDoctor: {
      type: Number,
      default: 0,
    },

    unreadByPatient: {
      type: Number,
      default: 0,
    },

    lastMessageSenderRole: { type: String, enum: ["patient", "doctor"] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Ensure one chat per patient-doctor pair
chatSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });

module.exports = mongoose.model("Chat", chatSchema);
