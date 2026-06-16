const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbot.controller");

// POST /api/chat
router.post("/", chatbotController.chat);

module.exports = router;
