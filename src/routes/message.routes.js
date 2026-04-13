const express = require("express");
const messageController = require("../controllers/message.controller.js");
const authController = require("../controllers/auth.controller");

const router = express.Router();

router.use(authController.protect);

router.get("/:chatId", messageController.getMessages);
router.post("/", messageController.sendMessage);

module.exports = router;
