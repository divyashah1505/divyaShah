const mongoose = require("mongoose");
const rewardsPointschema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
   membership_id: { type: mongoose.Schema.Types.ObjectId, ref: "userMembership", required: false },// Made false if not always present
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true }, 
  paymentIntentId: { type: String, required: true },// Add this line
  totalPoints: { type: Number, default: 0 }});
module.exports = mongoose.model("userRewards", rewardsPointschema);
