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
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
        totalItemPrice: { type: Number, required: true },
      },
    ],
    cartTotal: { type: Number, default: 0 },
  },
  { timestamps: true }
);


cartSchema.pre("save", async function () {
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
