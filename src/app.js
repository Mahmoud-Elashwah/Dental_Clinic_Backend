const express = require("express");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());

// Example route
app.get("/", (req, res) => {
  res.send("API is running");
});

module.exports = app;
