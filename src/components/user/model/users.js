const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { appString } = require("../../utils/appString");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: [true, appString.USERNAME_REQUIRED],
      trim: true,
      minlength: [6, "Username must be at least 6 characters long"],
      maxlength: [20, appString.LIMIT],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/.+@.+\..+/, "Please enter a valid email address"],
    },
    mobile: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    pendingEmail: { type: String, trim: true, lowercase: true },
    pendingMobile: { type: String, trim: true },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
    },
    file: { type: String },
    status: {
      type: Number,
      enum: [0, 1],
      default: 1,
    },
    isVerifiedByEmail: {
      type: Number,
      enum: [0, 1],
      default: 0,
    },
    isVerifiedByMobile: {
      type: Number,
      enum: [0, 1],
      default: 0,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    otp: { type: String, default: null },
    otpExpires: { type: Date, default: null },
    stripecustomer_Id:{
      type:String
    },
      totalPoints:{
            type:Number
        },

  },
  { timestamps: true }
);

userSchema.pre(["find", "findOne", "findOneAndUpdate", "findById"], async function () {
  await this.model.updateMany(
    { otpExpires: { $lt: new Date() }, otp: { $ne: null } },
    { $set: { otp: null, otpExpires: null } }
  );
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);