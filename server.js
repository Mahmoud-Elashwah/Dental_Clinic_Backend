// server.js
const app = require("./src/app");
const connectDB = require("./src/config/db");
const http = require("http");
const { Server } = require("socket.io");
const initializeSocket = require("./src/config/socket");   
require("dotenv").config();

const PORT = process.env.PORT || 3000;

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",                    
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000, 
});   

// Initialize Socket handlers
initializeSocket(io);

// Save io instance in app (for controllers)
app.set("io", io);

// Connect to Database then Start Server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📡 Socket.io is listening`);
  });
});