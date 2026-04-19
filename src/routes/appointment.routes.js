const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const appointmentController = require("../controllers/appointment.controller");
const { validate } = require("../middleware/validate.middleware");
const {
  createAppointmentValidation,
  updateAppointmentValidation,
  cancelAppointmentValidation,
} = require("../validation/appointment.validation");

router.use(authController.protect);

router.get(
  "/me",
  authController.restrict("patient"),
  appointmentController.getMyAppointments,
);

router
  .route("/")
  .get(
    authController.restrict("admin"),
    appointmentController.getAllAppointments,
  )
  .post(
    authController.restrict("patient"),
    validate(createAppointmentValidation),
    appointmentController.createAppointment,
  );

router.patch(
  "/:id/cancel",
  authController.restrict("admin", "patient"),
  validate(cancelAppointmentValidation),
  appointmentController.cancelAppointment,
);

router
  .route("/:id")
  .get(
    authController.restrict("admin", "patient"),
    appointmentController.getAppointmentById,
  )
  .patch(
    authController.restrict("admin", "patient"),
    validate(updateAppointmentValidation),
    appointmentController.updateAppointment,
  )
  .delete(
    authController.restrict("admin"),
    appointmentController.deleteAppointment,
  );

module.exports = router;
