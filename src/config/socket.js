// socket.js
const jwt = require("jsonwebtoken");
const Chat = require("../models/Chat");

module.exports = (io) => {
 io.use((socket, next) => {
  try {

    //find token in cookies
    let token = null;
    const cookies = socket.request.headers.cookie;
    if (cookies) {
      token = cookies.split("; ").find(row => row.startsWith("jwt="))?.split("=")[1];
    }

    // If not found in cookies, check query (for fallback)
    if (!token && socket.handshake.query.token) {
      token = socket.handshake.query.token;
    }

    if (!token) {
      return next(new Error("Authentication error: No token found"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    console.log("Socket auth error:", err.message);
    next(new Error("Invalid or expired token"));
  }
});

// Handle socket connections
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.id}`);

    // Join chat room
    socket.on("joinChat", async (chatId) => {
      try {
        const chat = await Chat.findById(chatId);

        if (!chat) {
          return socket.emit("error", "Chat not found");
        }

        // Check if user is part of the chat (either admin or patient)
        const isAllowed =
          socket.user.role === "admin" ||
          chat.patientId.toString() === socket.user.id;

        if (!isAllowed) {
          return socket.emit("error", "Not authorized");
        }

        // Join the chat room
        socket.join(chatId);
        console.log(`User ${socket.user.id} joined chat ${chatId}`);
      } catch (err) {
        console.log("Error joining chat:", err.message);
      }
    });

    // Leave chat room
    socket.on("leaveChat", (chatId) => {
      socket.leave(chatId);
    });

    // Typing indicator
   socket.on("typing", async ({ chatId, isTyping }) => {
  const chat = await Chat.findById(chatId);

  if (!chat) return;

  // Check if user is part of the chat (either admin or patient)
  const isAllowed =
    socket.user.role === "admin" ||
    chat.patientId.toString() === socket.user.id;

  if (!isAllowed) return;

  socket.to(chatId).emit("userTyping", {
    chatId,
    userId: socket.user.id,
    isTyping,
  });
});

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.user?.id}`);
    });
  });
};
