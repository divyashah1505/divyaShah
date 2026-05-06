const Cart = require("../model/cart");
const Product = require("../../Admin/model/product");
const Order = require("../../user/model/order");
const User = require("../../user/model/users");
const Address = require("../model/Address");
const Payment = require("../model/payment");
const PromoCode = require("../../Admin/model/PromoCode");
const mongoose = require("mongoose");
const config = require('../../../../config/development.js');
const stripe = require("stripe")(config.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');
const AdminSetting = require("../../Admin/model/adminSetting");
const { appString } = require("../../utils/appString");
const { applyPromoCode, calculateMembershipBenefits } = require("../../utils/commonUtils");
const UsedPromoCode = require("../../Admin/model/usedPromocode.js");
const userMembership = require("../model/userMembership");
const MembershipPlan = require("../../Admin/model/SubscriptionPlan");
const Wallet = require("../model/userWallet");

const razorpay = new Razorpay({
    key_id: 'rzp_test_SFVL6MdckklvfO',
    key_secret: 'ssfn0PT42G8pcDh0RLoKQ15M',
});

const orderController = {
    createOrderFromCart: async (req, res) => {
        try {
            const userId = new mongoose.Types.ObjectId(req?.user?.id);
            const manualCode =
                req.body?.code && req.body.code.trim() !== ""
                    ? req.body.code
                    : null;

            const { addressId } = req.body;

            // ✅ PARALLEL FETCH
            const [settings, cart, user, activeMembership, orderCount, wallet] =
                await Promise.all([
                    AdminSetting.findOne(),
                    Cart.findOne({ userId }),
                    User.findById(userId),
                    userMembership
                        .findOne({ userId, status: 1 })
                        .populate("membership_id"),
                    Order.countDocuments({ userId, status: 1 }),
                    Wallet.findOne({ userId }),
                ]);

            if (!settings)
                return res.status(400).json({ message: appString.NOTCONFIGURED });

            if (!cart || cart.items.length === 0)
                return res.status(400).json({ message: appString.CART_EMPTY });

            // 🔥 ✅ FIXED ADDRESS LOGIC (IMPORTANT)
            let address = null;

            // 1. If frontend sends addressId
            if (addressId) {
                address = await Address.findById(addressId);
            }

            // 2. Try primary address
            if (!address) {
                address = await Address.findOne({ userId, isPrimary: 1 });
            }

            // 3. Fallback → any address
            if (!address) {
                address = await Address.findOne({ userId });
            }

            if (!address) {
                return res.status(400).json({ message: "Address Not Found" });
            }

            // ✅ MEMBERSHIP CHECK
            if (orderCount >= 1 && !activeMembership) {
                return res
                    .status(403)
                    .json({ message: appString.MEMBERSHIPCOUMPSRY });
            }

            // ✅ CALCULATIONS
            const { membershipDiscount, deliveryCharge } =
                calculateMembershipBenefits(cart.cartTotal, activeMembership);

            const { finalTotal, discountAmount, appliedPromos } =
                await applyPromoCode(
                    cart.cartTotal - membershipDiscount,
                    PromoCode,
                    userId,
                    manualCode
                );

            const totalBeforeWallet = finalTotal + deliveryCharge;

            // ✅ WALLET LOGIC
            let walletAmountUsed = 0;
            if (req.body.useWallet && wallet && wallet.totalWithdraw_amount > 0) {
                walletAmountUsed = Math.min(wallet.totalWithdraw_amount, totalBeforeWallet);
            }

            const totalPayable = totalBeforeWallet - walletAmountUsed;
            const paymentAmount = Math.round(totalPayable * 100);

            // ✅ CREATE ORDER
            const newOrder = new Order({
                userId,
                cartId: cart._id,
                items: cart.items,
                cartTotal: cart.cartTotal,
                membershipDiscount,
                discountAmount,
                deliveryCharge,
                payableAmount: totalPayable,
                walletAmountUsed: walletAmountUsed,
                appliedPromoCode: appliedPromos.map((p) => p.code).join(", "),
                paymentMethod: settings.paymentMethod,
                shippingAddress: address.Address,
                status: (settings.paymentMethod === 2 || totalPayable === 0) ? 1 : 0,
            });

            // ✅ REMOVED: Immediate deduction (moved to madePayment/webhook)

            let clientSecret = null,
                razorpayOrderData = null;

            // ================= STRIPE =================
            if (settings.paymentMethod === 1 && totalPayable > 0) {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: paymentAmount,
                    currency: "inr",
                    receipt_email: user?.email,
                    customer: user?.stripecustomer_Id || undefined,
                    automatic_payment_methods: {
                        enabled: true,
                        allow_redirects: "never",
                    },
                    metadata: {
                        orderId: newOrder._id.toString(),
                        cartId: cart._id.toString(),
                    },
                });

                newOrder.stripePaymentIntentId = paymentIntent.id;
                clientSecret = paymentIntent.client_secret;
            }

            // ================= RAZORPAY =================
            else if (settings.paymentMethod === 3 && totalPayable > 0) {
                razorpayOrderData = await razorpay.orders.create({
                    amount: paymentAmount,
                    currency: "INR",
                    notes: {
                        orderId: newOrder._id.toString(),
                        cartId: cart._id.toString(),
                    },
                });

                newOrder.razorpayOrderId = razorpayOrderData.id;
            }

            // ================= FREE ORDER (Wallet covered all) =================
            // ✅ DEDUCT INVENTORY FOR COD / FREE ORDERS
            if (newOrder.status === 1) {
                const { deductStock } = require("../../utils/inventoryUtils");
                const invPromises = newOrder.items.map(async (item) => {
                    await deductStock(item.productId, item.variantId, item.quantity);
                });
                await Promise.all(invPromises);
                console.log(`Inventory deduction complete for ${settings.paymentMethod === 2 ? 'COD' : 'Free'} Order: ${newOrder._id}`);
            }

            await newOrder.save();

            // ✅ CLEAR CART FOR COD / FREE
            if (settings.paymentMethod === 2 || totalPayable === 0) {
                await Cart.findByIdAndDelete(cart._id);
            }

            // ✅ RESPONSE
            res.status(201).json({
                success: true,
                message: appString.ORDERINTIATED,
                order: newOrder,
                membershipDiscount,
                promoDiscount: discountAmount,
                deliveryCharge,
                finalPayable: totalPayable,
                clientSecret,
                razorpayOrder: razorpayOrderData,
            });
        } catch (err) {
            console.error("Order Creation Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    getOrderHistory: async (req, res) => {
        try {
            const userId = new mongoose.Types.ObjectId(req?.user?.id);

            const orders = await Order.find({ userId }).sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                message: "Order history fetched successfully",
                data: orders
            });
        } catch (err) {
            console.error("Order History Error:", err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = orderController;
