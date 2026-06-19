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
      enum: ["admin", "patient", "doctor"],
      default: "patient",
    },
    doctorProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
    bio: {
  type: String,
  maxlength: 500,
  default: "",
},

avatarUrl: {
  type: String,
  default: "",
},

  specialization: {
    type: String,
    enum: [
      "General Dentistry",
      "Orthodontics",
      "Endodontics",
      "Periodontics",
      "Prosthodontics",
      "Oral Surgery",
      "Pediatric Dentistry",
      "Cosmetic Dentistry",
    ],
    default: null,
  },
  
  workingHours: {
    sun: {
      start: { type: String, default: "09:00" },
      end: { type: String, default: "17:00" },
      isOff: { type: Boolean, default: false },
    },
    mon: {
      start: { type: String, default: "09:00" },
      end: { type: String, default: "17:00" },
      isOff: { type: Boolean, default: false },
    },
    tue: {
      start: { type: String, default: "09:00" },
      end: { type: String, default: "17:00" },
      isOff: { type: Boolean, default: false },
    },
    wed: {
      start: { type: String, default: "09:00" },
      end: { type: String, default: "17:00" },
      isOff: { type: Boolean, default: false },
    },
    thu: {
      start: { type: String, default: "09:00" },
      end: { type: String, default: "17:00" },
      isOff: { type: Boolean, default: false },
    },
    fri: {
      start: { type: String, default: "09:00" },
      end: { type: String, default: "17:00" },
      isOff: { type: Boolean, default: false },
    },
    sat: {
      start: { type: String, default: "09:00" },
      end: { type: String, default: "17:00" },
      isOff: { type: Boolean, default: false },
    },
  },

  slotDuration: {
    type: Number,
    default: 30,
    min: [15, "Slot duration must be at least 15 minutes"],
    max: [120, "Slot duration cannot exceed 120 minutes"],
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
    
    verificationCode: {
      type: String,
      select: false,
    },
    otpPurpose: {
      type: String,
      enum: ["FORGOT_PASSWORD", "EMAIL_VERIFICATION"],
    },
    otpExpire: {
      type: Date,
      select: false,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    
  },
  { timestamps: true },
);

// Update password change timestamp before saving if password is modified
userSchema.pre("save", async function () {
  if (!this.isModified("password") || this.isNew) return;
  this.passwordChangetAt = Date.now() - 1000;
});

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Instance method to compare passwords
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

// Create OTP for verification
userSchema.methods.createOTP = function (purpose) {
  // Generate a 6-digit random OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Hash the OTP before saving it to the database
  this.verificationCode = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
    
  this.otpExpire = Date.now() + 60 * 1000 * 10; // 10 minutes
  this.otpPurpose = purpose;
  
  return otp;
};

module.exports = mongoose.model("User", userSchema);
