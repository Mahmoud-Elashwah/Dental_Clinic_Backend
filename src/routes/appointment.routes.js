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
  "/available",
  authController.restrict("patient"),
  appointmentController.getAvailableSlots,
);

router.get(
  "/today",
  authController.restrict("admin"),
  appointmentController.getTodayAppointments,
);

router.get(
  "/patient/:patientId",
  authController.restrict("admin", "patient"),
  appointmentController.getPatientAppointments,
);

router.get(
  "/doctor/:doctorId",
  authController.restrict("admin"),
  appointmentController.getDoctorAppointments,
);


router
  .route("/")
  .get(
    authController.restrict("admin", "patient"),
    appointmentController.getAllAppointments,
  )
  .post(
    authController.restrict("patient"),
    validate(createAppointmentValidation),
    appointmentController.createAppointment,
  );



router
  .route("/:id")
  .get(
    authController.restrict("admin", "patient"),
    appointmentController.getAppointmentById,
  )
  .put(
    authController.restrict("admin", "patient"),
    validate(updateAppointmentValidation),
    appointmentController.updateAppointment,
  )
  .delete(
    authController.restrict("admin", "patient"),
    validate(cancelAppointmentValidation),
    appointmentController.cancelAppointment,
  );

module.exports = router;
