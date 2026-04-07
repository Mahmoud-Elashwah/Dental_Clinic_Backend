const app = require("./app");
const connectDB = require("./config/db");
require("dotenv").config();

const PORT = process.env.Port || process.env.PORT || 3000;

// Connect to MongoDB then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
