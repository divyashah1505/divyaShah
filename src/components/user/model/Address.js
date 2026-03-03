const mongoose = require("mongoose");
const { appString } = require("../../utils/appString");

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    Address: {
      type: String,
      required: [true, appString.ADDRESS_REQUIRED],
      minlength: [4, appString.ADD_LONG],
      maxlength: [20, appString.ADD_LIMIT],
      trim: true,
    },

    isPrimary: {
      type: Number,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Address", addressSchema);
