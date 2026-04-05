const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Define the User schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: [true, "Email already exists"],
      validate: [validator.isEmail, "not valid email or password"],
      lowercase: [true, "Email must be lowercase"],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Please provide a password"],
      minLength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "patient"],
      default: "patient",
    },

    phone: { type: String },

    dateOfBirth: { type: Date },

    refreshToken: {
      type: String,
      select: false,
    },

    resetpasswordToken: {
      type: String,
      select: false,
    },

    resetpasswordExpire: {
      type: Date,
      select: false,
    },

    passwordChangetAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true },
);

// Create an index on the email field for faster queries
//unique:true makes index
// userSchema.index({ email: 1 });

// Update password change timestamp
userSchema.pre("save", async function () {
  if (!this.isModified("password") || this.isNew) return;
  this.passwordChangetAt = Date.now() - 1000;
});

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

//check if the password is true
userSchema.methods.comparePassword = async function (password, userPassword) {
  return await bcrypt.compare(password, userPassword);
};

// Check if password was changed after token was issued
userSchema.methods.changePassword = function (jwtTimeStart) {
  if (this.passwordChangeAt) {
    timeInS = this.passwordChangeAt.getTime() / 1000;
    return timeInS > jwtTimeStart;
  }
  return false;
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetpasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetpasswordExpire = Date.now() + 60 * 1000 * 10;
  return resetToken;
};

module.exports = mongoose.model("User", userSchema);
