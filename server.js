const mongoose = require("mongoose");
const app = require("./src/app");
const connectDB = require("./src/config/db");

require("dotenv").config({ path: "./config.env" });

// Connect to MongoDB
 connectDB();

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
