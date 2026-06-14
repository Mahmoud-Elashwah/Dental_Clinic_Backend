const express = require("express");
const router = express.Router();
const User = require("../models/Users");
const doctorController = require("../controllers/doctor.controller");
const authController = require("../controllers/auth.controller");
const { validate } = require("../middleware/validate.middleware");
const {
  addDoctorValidation,
  updateDoctorValidation,
} = require("../validation/doctor.validation");


// Public routes

router.route("/").get(doctorController.getAllDoctors);

router.route("/:id").get(doctorController.getDoctorById);

router.route("/:id/availability").get(doctorController.getAvailability);


// AdminOnly routes 
// (protected  && restricted)

router.use(authController.protect, authController.restrict("admin","doctor"));
// router.use(authController.protect);

router.route("/").post(validate(addDoctorValidation), doctorController.addDoctor);

router
  .route("/:id")
  .patch(validate(updateDoctorValidation), doctorController.updateDoctor)
  .delete(doctorController.deleteDoctor);

module.exports = router;
