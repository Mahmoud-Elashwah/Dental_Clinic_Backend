const app = require("./src/app");
const connectDB = require("./src/config/db");
const http = require("http");
const { Server } = require("socket.io");
const initializeSocket = require("./src/config/socket");
require("dotenv").config();

const PORT = Number(process.env.PORT || 5000);

const startServer = async () => {
  try {
    await connectDB();
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: (process.env.CORS_ORIGIN || "http://localhost:5173")
          .split(",")
          .map((origin) => origin.trim()),
        methods: ["GET", "POST"],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    initializeSocket(io);
    app.set("io", io);

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} is already in use. Stop the other process or set a different PORT.`,
        );
      } else {
        console.error(`Failed to start server: ${error.message}`);
      }
      process.exit(1);
    });

    server.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      console.log("📡 Socket.io is active");
    });
  } catch (error) {
    console.error("Failed to start server.", {
      name: error.name,
      code: error.code,
    });
    process.exit(1);
  }
};

startServer();
