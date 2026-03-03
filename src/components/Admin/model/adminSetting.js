const mongoose = require("mongoose");

const adminSettingSchema = new mongoose.Schema(
  {
    paymentMethod: {
      type: Number,
      required: true, 
      enum: [1, 2, 3], 
      default: 1,    
    },
    stripeKey: { type: String },
    razorpayKey: { type: String },
  },
  { timestamps: true } 
);

module.exports = mongoose.model("AdminSetting", adminSettingSchema);
