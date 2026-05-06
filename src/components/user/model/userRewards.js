const mongoose = require("mongoose");
const rewardsPointschema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  membership_id: { type: mongoose.Schema.Types.ObjectId, ref: "userMembership", required: false },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: false }, 
  paymentIntentId: { type: String, required: true },
  totalPoints: { type: Number, default: 0 }
}, { timestamps: true });
module.exports = mongoose.model("userRewards", rewardsPointschema);
