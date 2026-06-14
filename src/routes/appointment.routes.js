const express = require("express");
const router = express.Router();
const User = require("../models/Users");
const Appointment = require("../models/Appointment");
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
  authController.restrict("admin", "doctor"),
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


router.get(
  "/me",
  authController.restrict("patient"),
  appointmentController.getMyAppointments
);

router
  .route("/:id")
  .get(
    authController.restrict("admin", "patient", "doctor"),
    appointmentController.getAppointmentById,
  )
  .patch(
    authController.restrict("admin", "patient", "doctor"),
    validate(updateAppointmentValidation),
    appointmentController.updateAppointment,
  )
  .delete(
    authController.restrict("admin", "patient", "doctor"),
    validate(cancelAppointmentValidation),
    appointmentController.cancelAppointment,
  );

router.patch(
  "/:id/cancel",
  authController.restrict("admin", "patient", "doctor"),
  appointmentController.cancelAppointment
);

router.delete("/admin/cleanup", async (req, res) => {
  const result = await Appointment.deleteMany({
    status: "cancelled",
  });

  res.json({
    message: "Cancelled appointments removed",
    deletedCount: result.deletedCount,
  });
});

module.exports = router;
