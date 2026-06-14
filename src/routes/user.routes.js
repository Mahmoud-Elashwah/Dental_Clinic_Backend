const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const userController = require("../controllers/user.controller");
router
  .route("/")
  .get(
    authController.protect,
    authController.restrict("admin"),
    userController.getAllUsers,
  );
router
  .route("/:id")
  .get(
    authController.protect,
    authController.restrict("admin", "patient"),
    userController.getUser,
  )
  .patch(
    authController.protect,
    authController.restrict("admin", "patient","doctor"),
    userController.updateUser,
  )
  .delete(
    authController.protect,
    authController.restrict("admin"),
    userController.DeleteUser,
  );

module.exports = router;
