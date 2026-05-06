const Cart = require("../model/cart");
const Product = require("../../Admin/model/product");
const { success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");
const mongoose = require("mongoose");

const cartController = {

  // ✅ ADD TO CART
addToCart: async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req?.user?.id);
    const { product: productsArray } = req.body;

    if (!Array.isArray(productsArray) || productsArray.length === 0) {
      return error(res, appString.REQUIRED, 400);
    }

    const validatedItems = [];

    // ✅ VALIDATION LOOP
    for (const item of productsArray) {
      const { productId, variantId, quantity } = item;

      console.log("Incoming:", item);

      if (!productId || !variantId) {
        return error(res, "ProductId and VariantId are required", 400);
      }

      const productData = await Product.findById(productId);

      if (!productData) {
        return error(res, appString.PRODUCT_NOT_FOUND, 404);
      }

      // ✅ SAFE VARIANT FIND
      const variant = productData.variants?.find(
        (v) => v._id?.toString() === variantId.toString()
      );

      if (!variant) {
        return error(res, "Variant not found", 404);
      }

      // ✅ STOCK CHECK
      if (quantity > variant.stock) {
        return error(
          res,
          `Only ${variant.stock} items available for ${productData.name} (${variant.size}, ${variant.color})`,
          400
        );
      }

      // ✅ PUSH CLEAN DATA
      validatedItems.push({
        productId: new mongoose.Types.ObjectId(productId),
        variantId: new mongoose.Types.ObjectId(variantId),

        name: productData.name,
        size: variant.size,
        color: variant.color,

        price: variant.price,
        quantity,
        totalItemPrice: variant.price * quantity,
      });
    }

    // ✅ FIND OR CREATE CART
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // ✅ 🔥 VERY IMPORTANT FIX (REMOVE OLD INVALID ITEMS)
    cart.items = cart.items.filter(item => item.variantId);

    // ✅ UPDATE / ADD ITEMS
    for (const item of validatedItems) {
      const { productId, variantId, quantity, price } = item;

      const itemIndex = cart.items.findIndex(
        (p) =>
          p.productId?.toString() === productId.toString() &&
          p.variantId?.toString() === variantId.toString()
      );

      if (quantity === 0) {
        if (itemIndex > -1) {
          cart.items.splice(itemIndex, 1);
        }
      } else {
        if (itemIndex > -1) {
          // ✅ UPDATE EXISTING
          cart.items[itemIndex].quantity = quantity;
          cart.items[itemIndex].price = price;
          cart.items[itemIndex].totalItemPrice = quantity * price;

          // optional: keep updated size/color
          cart.items[itemIndex].size = item.size;
          cart.items[itemIndex].color = item.color;

        } else {
          // ✅ ADD NEW
          cart.items.push(item);
        }
      }
    }

    // ✅ REMOVE CART IF EMPTY
    if (cart.items.length === 0) {
      await Cart.findByIdAndDelete(cart._id);
      return success(res, null, appString.CART_REMOVED, 200);
    }

    // ✅ SAVE CART
    await cart.save();

    return success(res, cart, appString.CART_ADDED, 200);

  } catch (err) {
    console.error("AddToCart Error:", err);
    return error(res, err.message || appString.CART_ERROR, 400);
  }
},



  // ✅ GET CART
  getCart: async (req, res) => {
    try {
      const userId = new mongoose.Types.ObjectId(req?.user?.id);

      const cart = await Cart.findOne({ userId }).lean();

      if (!cart || !cart.items || cart.items.length === 0) {
        return success(res, {
          items: [],
          totalAmount: 0,
        }, "Cart is empty");
      }

      let totalAmount = 0;
      const updatedItems = [];

      for (const item of cart.items) {

        const product = await Product.findById(item.productId).lean();
        if (!product) continue;

        // ✅ find variant
        const variant = product.variants?.find(
          (v) => v._id?.toString() === item.variantId?.toString()
        );

        // ✅ OLD DATA fallback (will disappear after cleanup)
        if (!variant && !item.variantId) {
          const itemTotal = item.price * item.quantity;

          totalAmount += itemTotal;

          updatedItems.push({
            productId: product._id,
            variantId: null,

            name: product.name,
            image: product.images?.[0] || null,

            size: null,
            color: null,

            price: item.price,
            quantity: item.quantity,
            totalItemPrice: itemTotal,

            stock: null,
          });

          continue;
        }

        if (!variant) continue;

        const itemTotal = variant.price * item.quantity;
        totalAmount += itemTotal;

        updatedItems.push({
          productId: product._id,
          variantId: variant._id, // ✅ FIXED

          name: product.name,
          image: product.images?.[0] || null,

          size: variant.size,
          color: variant.color,

          price: variant.price,
          quantity: item.quantity,
          totalItemPrice: itemTotal,

          stock: variant.stock,
        });
      }

      return success(res, {
        items: updatedItems,
        totalAmount,
      }, "Cart fetched successfully");

    } catch (err) {
      console.error("GetCart Error:", err);
      return error(res, err.message || "Error fetching cart", 400);
    }
  }

};

module.exports = cartController;