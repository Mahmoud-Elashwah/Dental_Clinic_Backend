const express = require("express");
const reviewController = require("../controllers/review.controller");
const authController = require("../controllers/auth.controller");

const router = express.Router();

router.route("/").post(
  authController.protect,
  authController.restrict("patient"),
  reviewController.addReview
);

router.route("/doctor/:doctorId").get(reviewController.getDoctorReviews);

module.exports = router;
