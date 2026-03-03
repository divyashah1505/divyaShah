const mongoose = require("mongoose");

const UsedPromoCodeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  promoCodeId: { type: mongoose.Schema.Types.ObjectId, ref: "PromoCode", required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  redeemedAt: { type: Date, default: Date.now }
});

UsedPromoCodeSchema.index({ userId: 1, promoCodeId: 1 }, { unique: true });

module.exports = mongoose.model("UsedPromoCode", UsedPromoCodeSchema);
