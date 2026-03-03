const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cartId: { type: mongoose.Schema.Types.ObjectId, ref: "Cart", required: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Products", required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
        totalItemPrice: { type: Number, required: true },
      },
    ],
    shippingAddress: { type: String, required: true },
    cartTotal: { type: Number, required: true },
    status: {
      type: Number,
      enum: [0, 1, 2], // pending(0), success(1), cancelled(2)
      default: 0,
    },
    stripeSessionId: { type: String }, 
    razorpayOrderId: { type: String },  
    paymentMethod: {
      type: Number,
      required: true,
      enum: [1, 2, 3], // 1: Stripe, 2: COD, 3: Razorpay
    },
    stripecustomerid:{
      type:String
    },
    stripePaymentIntentId:{
      type:String
    },
    delivercharge:{
      type:Number
    }
  },
  { timestamps: true }
);

orderSchema.pre('save', async function() {
    this.cartTotal = this.items.reduce((total, item) => total + (item.totalItemPrice || 0), 0);
    if (this.cartTotal < 0) throw new Error('Cart total cannot be negative');
});

module.exports = mongoose.model("Order", orderSchema);
