const express = require("express");
const messageController = require("../controllers/message.controller.js");
const authController = require("../controllers/auth.controller");

const router = express.Router();

router.use(authController.protect);

router.get("/:chatId", messageController.getMessages);
router.post("/", messageController.sendMessage);
router.patch("/:id", messageController.editMessage);
router.delete("/:id", messageController.deleteMessage);

module.exports = router;
