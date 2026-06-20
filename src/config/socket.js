// socket.js
const jwt = require("jsonwebtoken");
const Chat = require("../models/Chat");

module.exports = (io) => {
 io.use((socket, next) => {
  try {

    // Find token in query first (explicit from frontend localStorage)
    let token = socket.handshake.query.token;

    // If not found in query, check cookies (for fallback)
    if (!token) {
      const cookies = socket.request.headers.cookie;
      if (cookies) {
        token = cookies.split("; ").find(row => row.startsWith("jwt="))?.split("=")[1];
      }
    }

    if (!token) {
      return next(new Error("Authentication error: No token found"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user to get role
    const User = require("../models/Users");
    User.findById(decoded.id).then(user => {
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }
      socket.user = { id: decoded.id, role: user.role };
      next();
    }).catch(err => {
      console.log("Socket DB error:", err.message);
      next(new Error("Authentication error: Database error"));
    });
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
      console.log(`[Socket] Received joinChat for ${chatId} from user ${socket.user.id}`);
      try {
        const chat = await Chat.findById(chatId);

        if (!chat) {
          console.log(`[Socket] Chat not found: ${chatId}`);
          return socket.emit("error", "Chat not found");
        }

        // Check if user is part of the chat (either doctor or patient)
        const isAllowed =
          (socket.user.role === "doctor" && chat.doctorId.toString() === socket.user.id) ||
          chat.patientId.toString() === socket.user.id;

        if (!isAllowed) {
          console.log(`[Socket] Unauthorized! Role: ${socket.user.role}, docId: ${chat.doctorId}, patId: ${chat.patientId}, socketId: ${socket.user.id}`);
          return socket.emit("error", "Not authorized");
        }

        // Join the chat room
        socket.join(chatId);
        console.log(`[Socket] SUCCESS: User ${socket.user.id} joined chat ${chatId}`);
      } catch (err) {
        console.log("[Socket] Error joining chat:", err.message);
      }
    });

    // Leave chat room
    socket.on("leaveChat", (chatId) => {
      console.log(`[Socket] Received leaveChat for ${chatId} from user ${socket.user.id}`);
      socket.leave(chatId);
    });

    // Typing indicator
   socket.on("typing", async ({ chatId, isTyping }) => {
  const chat = await Chat.findById(chatId);

  if (!chat) return;

  // Check if user is part of the chat (either doctor or patient)
  const isAllowed =
    (socket.user.role === "doctor" && chat.doctorId.toString() === socket.user.id) ||
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
      console.log(`?? User disconnected: ${socket.user?.id}`);
    });
  });
};
