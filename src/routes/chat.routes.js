const express = require("express");
const chatController = require("../controllers/chat.controller");
const authController = require("../controllers/auth.controller");

const router = express.Router();

router.use(authController.protect);

// Chats
router.get("/", chatController.getChats);
router.get("/:id", chatController.getChat);
router.post("/", chatController.createChat);
router.patch("/:chatId/markAsRead", chatController.markChatAsRead);

// Messages

module.exports = router;
