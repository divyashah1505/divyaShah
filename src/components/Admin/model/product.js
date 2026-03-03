const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    image: { type: String, default: "" },
    qty: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    maincategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    status: { type: Number, default: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Products", productSchema);
