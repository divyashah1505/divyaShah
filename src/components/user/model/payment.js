const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true }, 
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  order_reference: { type: String, required: true, trim: true }, 

  razorpayOrderId: { type: String, trim: true },
  razorpayPaymentId: { type: String, trim: true },
  chargeId: { type: String, index: true }, 
  amount: { type: Number, required: true },
  currency: { type: String, default: 'inr' },
  stripePaymentIntentId: {
    type: String,
    required: true,
    trim: true
  },
      stripecustomer_Id: String,

  status: { type: Number, enum: [0, 1, 2], default: 0 }, 
  paymentMethodType: { type: Number, enum: [1, 2, 3] }, 
  rawDetails: { type: Object }
}, { timestamps: true });

paymentSchema.index(
  { stripePaymentIntentId: 1 },
  { unique: true, partialFilterExpression: { stripePaymentIntentId: { $type: "string" } } }
);

module.exports = mongoose.model("Payment", paymentSchema);
