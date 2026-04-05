const User = require("../models/Users");
const catchAsync = require("../utils/CatchAsync");
const appError = require("../utils/AppError");
const sendEmail = require("../utils/email");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const crypto = require("crypto");
const { promisify } = require("util");

//create Token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

//sendToken
const sendToken = (user, res, statuscode) => {
  const accesstoken = signToken(user._id);
  // Set cookie options
  const cookiesOptions = {
    httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
  };

  // Create refresh token with a custom claim to identify it as a refresh token
  const refreshToken = jwt.sign(
    { id: user._id, countEX: 7 },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  // Set secure flag for cookies in production
  if (process.env.NODE_ENV === "production") cookiesOptions.secure = true; // Ensures the cookie is only sent over HTTPS in production

  res.cookie("jwt", accesstoken, cookiesOptions);
  res.status(statuscode).json({
    status: "success",
    access_token: accesstoken,
    refresh_token: refreshToken,
    data: { user },
  });
};

//signUp
exports.register = catchAsync(async (req, res, next) => {
  const user = await User.create(req.body);
  user.password = undefined;
  sendToken(user, res, 201);
});

//logIn
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password)
    return next(new appError("please enter email and password", 400));

  const user = await User.findOne({ email }).select("+password");

  // Check if user exists and password is correct
  if (!user || !(await user.comparePassword(password, user.password)))
    return next(new appError("email or password not correct", 404));

  user.password = undefined;
  sendToken(user, res, 200);
});

//authorization
exports.protect = catchAsync(async (req, res, next) => {
  let token;

  // Check for token in cookies or Authorization header
  if (req.cookies.jwt) token = req.cookies.jwt;
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  )
    token = req.headers.authorization.split(" ")[1];
  else return next(new appError("please logIn first", 401));

  // Verify token and get user data
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);
  if (!user)
    return next(
      new appError("user belong this token not exist,please signUp", 401),
    );

  // Check if user changed password after token was issued
  if (user.changePassword(decoded.iat))
    return next(
      new appError("you recenty change password,please logIn again", 401),
    );

  req.user = user;
  next();
});

//roles
exports.restrict = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return next(
        new appError(`you don't have permision to perform this action`, 403),
      );
    next();
  };
};

//logOut
exports.logout = catchAsync(async (req, res, next) => {
  res.cookie("jwt", "loggedOut", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({
    status: "success",
    message: "you are loged out",
  });
});

//forgetToken
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // Find user by email
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new appError("no user with this email", 404));

  // Generate reset token and save to user document
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // Create reset URL and email message
  const resetUrl = `${req.protocol}://${req.get(
    "host",
  )}/api/v1/auth/resetPassword/${resetToken}`;

  // Email message to user
  const message = `Forgot your password? Submit a PATCH 
  request with your new password and passwordConfirm to:
   ${resetUrl}`;

  try {
    await sendEmail({
      to: user.email,
      message,
      subject: "your password reset token( valid for 10 mintues)",
    });
    res.status(200).json({
      status: "success",
      message: "token send to email",
    });
  } catch (err) {
    user.resetpasswordToken = undefined;
    user.resetpasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    next(
      new appError(
        "there was an error sending the email,please try again later",
        500,
      ),
    );
  }
});

//resetPassword
exports.resetPassword = catchAsync(async (req, res, next) => {
  // Hash the reset token from the URL and find the user with that token and check if it's not expired
  const hashToken = crypto
    .createHash("sha256")
    .update(req.params.resetToken)
    .digest("hex");
  const user = await User.findOne({
    resetpasswordToken: hashToken,
    resetpasswordExpire: { $gte: Date.now() },
  });
  if (!user) return next(new appError("token not valid or expired", 404));
  const { password } = req.body;

  // Check if password is provided
  if (!password) return next(new appError("please enter password ", 400));

  // Update user's password and clear reset token fields
  user.password = req.body.password;
  user.resetpasswordToken = undefined;
  user.resetpasswordExpire = undefined;
  await user.save();

  sendToken(user, res, 200);
});

//changePassword
exports.changePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  // Check if current password is correct and if new password is provided
  if (
    !user ||
    !(await user.comparePassword(req.body.passwordCurrent, user.password))
  )
    return next(new appError("your current password is wrong", 401));
  if (!req.body.password)
    return next(new appError("please enter new password ", 400));

  // Update user's password
  user.password = req.body.password;
  await user.save();

  sendToken(user, res, 200);
});

//createRefreshToken
exports.createRefreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return next(new appError("refresh token required", 400));

  const decoded = await promisify(jwt.verify)(
    refreshToken,
    process.env.JWT_SECRET,
  );

  if (!decoded || decoded.countEX <= 0)
    return next(new appError("invalid refresh token", 401));

  const user = await User.findById(decoded.id);
  if (!user) return next(new appError("user not found", 404));

  const accessToken = signToken(user._id);
  const newRefreshToken = jwt.sign(
    { id: user._id, countEX: decoded.countEX - 1 },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  sendToken(user, res, 200);
});

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({
    status: "success",
    data: { user },
  });
});
