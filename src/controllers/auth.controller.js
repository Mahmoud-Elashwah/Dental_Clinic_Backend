const User = require("../models/Users");
const catchAsync = require("../utils/CatchAsync");
const appError = require("../utils/AppError");
const sendEmail = require("../utils/email");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const crypto = require("crypto");
const { promisify } = require("util");
const {
  getResetPasswordHtml,
} = require("../emails/verification-resetpassword");
const {
  getPasswordResetConfirmationEmailHtml,
} = require("../emails/reset-password-email");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_SECRET_REFRESH;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_SECRET_REFRESH must be configured.");
}
if (
  process.env.NODE_ENV === "production" &&
  (JWT_SECRET.length < 32 ||
    JWT_REFRESH_SECRET.length < 32 ||
    JWT_SECRET === JWT_REFRESH_SECRET)
) {
  throw new Error(
    "Production JWT secrets must be distinct values of at least 32 characters.",
  );
}

const signToken = (id, secret, expiresIn, tokenType, tokenVersion = 0) =>
  jwt.sign({ id: String(id), tokenType, tokenVersion }, secret, { expiresIn });

const issueTokenPair = (userId, tokenVersion = 0) => ({
  accessToken: signToken(
    userId,
    JWT_SECRET,
    process.env.JWT_EXPIRES_IN || "15m",
    "access",
    tokenVersion,
  ),
  refreshToken: signToken(
    userId,
    JWT_REFRESH_SECRET,
    "7d",
    "refresh",
    tokenVersion,
  ),
});

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const storeRefreshToken = (userId, refreshToken) =>
  User.updateOne(
    { _id: userId },
    { $set: { refreshToken: hashToken(refreshToken) } },
  );

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
});

const setTokenCookies = (res, { accessToken, refreshToken }) => {
  res.cookie("jwt", accessToken, cookieOptions());
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const safeUser = (user) => {
  const value = user.toObject ? user.toObject() : { ...user };
  delete value.password;
  delete value.refreshToken;
  delete value.tokenVersion;
  delete value.passwordChangetAt;
  delete value.resetpasswordToken;
  delete value.resetpasswordExpire;
  delete value.verificationCode;
  delete value.otpExpire;
  delete value.otpPurpose;
  delete value.failedLoginAttempts;
  delete value.lockedUntil;
  return value;
};

const sendToken = async (user, res, statusCode) => {
  const tokens = issueTokenPair(user._id, user.tokenVersion || 0);
  await storeRefreshToken(user._id, tokens.refreshToken);
  setTokenCookies(res, tokens);

  res.status(statusCode).json({
    status: "success",
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    data: { user: safeUser(user) },
  });
};

//signUp
exports.register = catchAsync(async (req, res, next) => {
  const user = await User.create({ ...req.body, role: "patient" });
  user.password = undefined;
  await sendToken(user, res, 201);
});

//logIn
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password)
    return next(new appError("please enter email and password", 400));

  const lowerEmail = email.toLowerCase();
  const invalidCredentials = new appError(
    "Email or password is incorrect.",
    401,
  );
  const user = await User.findOne({ email: lowerEmail }).select(
    "+password +tokenVersion +failedLoginAttempts +lockedUntil",
  );

  if (!user) {
    return next(invalidCredentials);
  }
  if (!user.isActive) {
    return next(invalidCredentials);
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    return next(invalidCredentials);
  }

  // Check if password is correct
  if (!(await user.comparePassword(password, user.password))) {
    // Increment failed attempts
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
    }
    await user.save({ validateBeforeSave: false });
    return next(invalidCredentials);
  }

  // Reset failed attempts on successful login
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  await user.save({ validateBeforeSave: false });

  user.password = undefined;
  await sendToken(user, res, 200);
});

//authorization
exports.protect = catchAsync(async (req, res, next) => {
  let token;
  const authorization = /^Bearer\s+(\S+)$/i.exec(
    req.headers.authorization || "",
  );

  // Check for token in cookies or Authorization header
  if (req.cookies?.jwt) token = req.cookies.jwt;
  else if (authorization) token = authorization[1];
  else return next(new appError("please logIn first", 401));

  // Verify token and get user data
  const decoded = await promisify(jwt.verify)(token, JWT_SECRET);
  if (decoded.tokenType !== "access") {
    return next(
      new appError("Invalid access token. Please log in again.", 401),
    );
  }

  const user = await User.findById(decoded.id).select(
    "+passwordChangetAt +tokenVersion",
  );
  if (!user)
    return next(
      new appError("user belong this token not exist,please signUp", 401),
    );

  if (!user.isActive) {
    return next(new appError("This account is inactive.", 401));
  }

  if (decoded.tokenVersion !== (user.tokenVersion || 0)) {
    return next(
      new appError("This token is no longer valid. Please log in again.", 401),
    );
  }

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
  await User.updateOne(
    { _id: req.user._id },
    { $unset: { refreshToken: 1 }, $inc: { tokenVersion: 1 } },
  );
  const options = cookieOptions();
  res.clearCookie("jwt", options);
  res.clearCookie("refreshToken", options);
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
  if (!user) {
    return res.status(202).json({
      status: "success",
      message:
        "If the account exists and email delivery is available, reset instructions will be sent.",
    });
  }

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
  } catch (err) {
    console.error("Password reset email delivery failed.", {
      name: err.name,
      code: err.code,
    });
    user.verificationCode = undefined;
    user.otpExpire = undefined;
    user.otpPurpose = undefined;
    await user.save({ validateBeforeSave: false });
    return res.status(202).json({
      status: "success",
      message:
        "If the account exists and email delivery is available, reset instructions will be sent.",
    });
  }
  return res.status(202).json({
    status: "success",
    message:
      "If the account exists and email delivery is available, reset instructions will be sent.",
  });
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
  }).select("+tokenVersion");
  if (!user) return next(new appError("token not valid or expired", 404));
  const { password } = req.body;

  // Check if password is provided
  if (!password) return next(new appError("please enter password ", 400));

  // Update user's password and clear reset token fields
  user.password = req.body.password;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
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
    console.error("Password reset confirmation email failed.", {
      name: err.name,
      code: err.code,
    });
  }

  await sendToken(user, res, 200);
});

//changePassword
exports.changePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select(
    "+password +tokenVersion",
  );

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
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  await sendToken(user, res, 200);
});

//createRefreshToken
exports.createRefreshToken = catchAsync(async (req, res, next) => {
  const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;

  if (!refreshToken) return next(new appError("refresh token required", 400));

  let decoded;
  try {
    decoded = await promisify(jwt.verify)(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    return next(new appError("Invalid or expired refresh token.", 401));
  }

  if (decoded.tokenType !== "refresh") {
    return next(new appError("Invalid refresh token.", 401));
  }

  const user = await User.findById(decoded.id).select(
    "+refreshToken +passwordChangetAt +tokenVersion",
  );
  if (!user) return next(new appError("user not found", 404));
  if (
    !user.isActive ||
    !user.refreshToken ||
    decoded.tokenVersion !== (user.tokenVersion || 0) ||
    user.changePassword(decoded.iat)
  ) {
    return next(new appError("Refresh token is no longer valid.", 401));
  }

  const storedHash = Buffer.from(user.refreshToken, "hex");
  const presentedHash = Buffer.from(hashToken(refreshToken), "hex");
  if (
    storedHash.length !== presentedHash.length ||
    !crypto.timingSafeEqual(storedHash, presentedHash)
  ) {
    return next(new appError("Refresh token is no longer valid.", 401));
  }

  const tokens = issueTokenPair(user._id, user.tokenVersion || 0);
  const rotation = await User.updateOne(
    { _id: user._id, refreshToken: user.refreshToken },
    { $set: { refreshToken: hashToken(tokens.refreshToken) } },
  );
  if (rotation.modifiedCount !== 1) {
    return next(new appError("Refresh token is no longer valid.", 401));
  }

  setTokenCookies(res, tokens);

  res.status(200).json({
    status: "success",
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    data: { user: safeUser(user) },
  });
});

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({
    status: "success",
    data: { user: safeUser(user) },
  });
});

exports.issueTokenPair = issueTokenPair;
exports.storeRefreshToken = storeRefreshToken;
exports.setTokenCookies = setTokenCookies;
