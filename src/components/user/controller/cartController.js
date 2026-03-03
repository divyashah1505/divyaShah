const Cart = require("../model/cart");
const Product = require("../../Admin/model/product");
const { success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");
const mongoose = require("mongoose");
const cartController = {
	addToCart: async (req, res) => {
		try {
			const userId = new mongoose.Types.ObjectId(req?.user?.id);
			const { product: productsArray } = req?.body;

			if (!productsArray || !Array.isArray(productsArray) || productsArray.length === 0) {
				return error(res, appString.REQUIRED, 400);
			}

			const validatedItems = [];
			for (const item of productsArray) {
				const productData = await Product.findById(item.productId);

				if (!productData) {
					return error(res, appString.PRODUCT_NOT_FOUND, 404);
				}


				if (item.price !== productData.price) {
					return error(
						res,
						`Invalid price for ${productData.name}. Expected ${productData.price}, but got ${item.price}`,
						400
					);
				}

				if (item.quantity > productData.qty) {
					return error(
						res,
						`Insufficient stock. Only ${productData.qty} units available for ${productData.name}`,
						400
					);
				}

				if (item.price < 0) {
					return error(res, appString.NEGATIVE, 400);
				}

				validatedItems.push({ ...item, name: productData.name });
			}

			let cart = await Cart.findOne({ userId });
			if (!cart) {
				cart = new Cart({ userId, items: [] });
			}

			for (const item of validatedItems) {
				const { productId, quantity, price, name } = item;
				const itemIndex = cart.items.findIndex(
					(p) => p.productId.toString() === productId
				);

				if (quantity === 0) {
					if (itemIndex > -1) {
						cart.items.splice(itemIndex, 1);
					}
				} else {
					if (itemIndex > -1) {
						cart.items[itemIndex].quantity = quantity;
						cart.items[itemIndex].price = price;
						cart.items[itemIndex].totalItemPrice = quantity * price;
					} else {
						cart.items.push({
							productId,
							name: name,
							quantity,
							price: price,
							totalItemPrice: quantity * price,
						});
					}
				}
			}

			if (cart.items.length === 0) {
				if (!cart.isNew) {
					await Cart.findByIdAndDelete(cart._id);
				}
				return success(res, null, appString.CART_REMOVED, 200);
			}

			await cart.save();
			return success(res, cart, appString.CART_ADDED, 200);
		} catch (err) {
			return error(res, err.message || appString.CART_ERROR, 400);
		}
	},


};

module.exports = cartController;
