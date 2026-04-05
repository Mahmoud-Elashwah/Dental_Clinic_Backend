const User = require("../models/Users");
const catchAsync = require("../utils/CatchAsync");
const appError = require("../utils/AppError");
const APIFeatures = require("../utils/apiFeatures.js");

//get all users by admin
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(User.find(), req.query)
    .filter()
    .sort()
    .fields() // select specific fields
    .paginate();

  const users = await features.query;

  res.status(200).json({
    status: "success",
    result: users.length,
    data: users,
  });
});

//get user by admin or own profile
exports.getUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (req.user.role !== "admin" && req.user.id !== id) {
    return next(new AppError("You are not allowed to access this user", 403));
  }
  const user = await User.findById(id);
  if (!user) {
    return next(new appError("User not found", 404));
  }
  res.status(200).json({
    status: "success",
    data: user,
  });
});

//update user's name,phone,and dateOfBirth by admin or own profile
exports.updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (req.user.role !== "admin" && req.user.id !== id) {
    return next(new AppError("You are not allowed to access this user", 403));
  }

  const { name, phone, dateOfBirth } = req.body;

  const user = await User.findByIdAndUpdate(
    id,
    { name, phone, dateOfBirth },
    {
      returnDocument: "after", // like new but new not supported any more
      runValidators: true,
    },
  );
  if (!user) {
    return next(new appError("User not found", 404));
  }
  res.status(200).json({
    status: "success",
    data: user,
  });
});

//delete user by admin
exports.DeleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return next(new appError("User not found", 404));
  }
  res.status(200).json({
    status: "success",
    message: "User deleted successfully",
  });
});
