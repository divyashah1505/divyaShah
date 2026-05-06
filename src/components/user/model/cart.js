const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Products",
          required: true,
        },

        // ✅ ADD THIS (FIXES YOUR MAIN ISSUE)
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },

        name: { type: String, required: true },

        // ✅ ADD THESE (for frontend display)
        size: { type: String },
        color: { type: String },

        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
        totalItemPrice: { type: Number, required: true },
      },
    ],

    cartTotal: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ✅ AUTO CALCULATE CART TOTAL
cartSchema.pre("save", function () {
  if (this.items && this.items.length > 0) {
    this.cartTotal = this.items.reduce(
      (acc, item) => acc + item.totalItemPrice,
      0
    );
  } else {
    this.cartTotal = 0;
  }
});

module.exports = mongoose.model("Cart", cartSchema);