const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { appString } = require("../../utils/appString");

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: [true, appString.USERNAME_REQUIRED],
      trim: true,
      minlength: [4, appString.LONG],
      maxlength: [20, appString.LIMIT],
    },
    email: {
      type: String,
      unique: true,
      required: [true, appString.EMAIL_REQUIRED],
      trim: true,
      lowercase: true,
      match: [/.+@.+\..+/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

adminSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

adminSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

adminSchema.statics.softDelete = function (id) {
  return this.findByIdAndUpdate(id, { deletedAt: new Date() });
};

module.exports = mongoose.model("Admin", adminSchema);
