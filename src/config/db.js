const mongoose = require("mongoose");
require("dotenv").config({ path: ".env" });

const connectDB = async () => {
  const mongoUri =
    process.env.MONGO_URI ||
    (process.env.NODE_ENV === "production"
      ? null
      : "mongodb://127.0.0.1:27017/dental_clinic");

  if (!mongoUri) {
    throw new Error("MONGO_URI must be configured in production.");
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed.", {
      name: error.name,
      code: error.code,
    });
    throw error;
  }
};

module.exports = connectDB;
