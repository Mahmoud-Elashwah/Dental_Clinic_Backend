const User = require("../models/Users");
const catchAsync = require("../utils/CatchAsync");
const appError = require("../utils/AppError");
const sendEmail = require("../utils/email");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const crypto = require("crypto");
const { promisify } = require("util");
const { getResetPasswordHtml } = require("../emails/verification-resetpassword");
const { getPasswordResetConfirmationEmailHtml } = require("../emails/reset-password-email");

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

  const lowerEmail = email.toLowerCase();
  const user = await User.findOne({ email: lowerEmail }).select("+password");

  if (!user) {
    return next(new appError("email or password not correct", 404));
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    const remainingMinutes = Math.ceil((user.lockedUntil - Date.now()) / 1000 / 60);
    return next(new appError(`Account is locked. Please try again after ${remainingMinutes} minutes`, 403));
  }

  // Check if password is correct
  if (!(await user.comparePassword(password, user.password))) {
    // Increment failed attempts
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
    }
    await user.save({ validateBeforeSave: false });
    return next(new appError("email or password not correct", 404));
  }

  // Reset failed attempts on successful login
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  await user.save({ validateBeforeSave: false });

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

//forgetPassword
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // Find user by email
  const emailLower = req.body.email.toLowerCase();
  const user = await User.findOne({ email: emailLower });
  if (!user) return next(new appError("no user with this email", 404));

  // Generate OTP and save to user document
  const otp = user.createOTP("FORGOT_PASSWORD");
  await user.save({ validateBeforeSave: false });

  // Email message to user
  const htmlMessage = getResetPasswordHtml(otp);

  try {
    await sendEmail({
      to: user.email,
      html: htmlMessage, // We will update utils/email to support html
      subject: "Your Password Reset OTP (Valid for 10 minutes)",
    });
    res.status(200).json({
      status: "success",
      message: "OTP sent to email",
    });
  } catch (err) {
    console.error("Email send error: ", err);
    user.verificationCode = undefined;
    user.otpExpire = undefined;
    user.otpPurpose = undefined;
    await user.save({ validateBeforeSave: false });
    next(
      new appError(
        "there was an error sending the email: " + (err.message || JSON.stringify(err)),
        500,
      ),
    );
  }
});

//verifyOTP
exports.verifyOTP = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new appError("Please provide email and OTP", 400));
  }

  // Hash the OTP to compare with the stored hash
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

  const emailLower = email.toLowerCase();
  const user = await User.findOne({
    email: emailLower,
    verificationCode: hashedOTP,
    otpExpire: { $gte: Date.now() },
    otpPurpose: "FORGOT_PASSWORD",
  });

  if (!user) {
    return next(new appError("OTP is invalid or has expired", 400));
  }

  // Clear OTP fields and generate a reset token for the final step
  user.verificationCode = undefined;
  user.otpExpire = undefined;
  user.otpPurpose = undefined;
  
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "OTP verified successfully",
    resetToken,
  });
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
  
  // Send success confirmation email
  try {
    const htmlMessage = getPasswordResetConfirmationEmailHtml(user.email);
    await sendEmail({
      to: user.email,
      html: htmlMessage,
      subject: "Password Reset Successful",
    });
  } catch (err) {
    console.log("Error sending confirmation email: ", err);
  }

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
