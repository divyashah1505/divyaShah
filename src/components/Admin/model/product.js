const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    images: [{ type: String }], // multiple images

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

    // 👇 ADD THIS (IMPORTANT)
    variants: [
      {
        size: { type: String, required: true },   // S, M, L
        color: { type: String, required: true },  // Black, White
        stock: { type: Number, default: 0 },
        price: { type: Number, default: 0 }
      }
    ],

    status: { type: Number, default: 1 },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Products", productSchema);
