const Cart = require("../model/cart");
const Product = require("../../Admin/model/product");
const Order = require("../../user/model/order");
const User = require("../../user/model/users");
const Address = require("../model/Address");
const Payment = require("../model/payment");
const PromoCode = require("../../Admin/model/PromoCode"); 
const mongoose = require("mongoose");
const config = require('../../../../config/development.json');
const stripe = require("stripe")(config.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');
const AdminSetting = require("../../Admin/model/adminSetting");
const { appString } = require("../../utils/appString");
const { applyPromoCode, calculateMembershipBenefits } = require("../../utils/commonUtils"); 
const UsedPromoCode = require("../../Admin/model/usedPromocode.js");
const userMembership = require("../model/userMembership");
const MembershipPlan = require("../../Admin/model/SubscriptionPlan"); 

const razorpay = new Razorpay({
  key_id: 'rzp_test_SFVL6MdckklvfO',
  key_secret: 'ssfn0PT42G8pcDh0RLoKQ15M',
});

const orderController = {
    createOrderFromCart: async (req, res) => {
        try {
            const userId = new mongoose.Types.ObjectId(req?.user?.id);
            const manualCode = (req.body?.code && req.body.code.trim() !== "") ? req.body.code : null;

            const [settings, cart, primaryAddress, user, activeMembership, orderCount] = await Promise.all([
                AdminSetting.findOne(),
                Cart.findOne({ userId }),
                Address.findOne({ userId, isPrimary: 1 }),
                User.findById(userId),
                userMembership.findOne({ userId, status: 1 }).populate('membership_id'),
                Order.countDocuments({ userId, status: 1 })
            ]);

            if (!settings) return res.status(400).json({ message: appString.NOTCONFIGURED });
            if (!cart || cart.items.length === 0) return res.status(400).json({ message: appString.CART_EMPTY });
            if (!primaryAddress) return res.status(400).json({ message: appString.ANOT_FOUND });

            if (orderCount >= 1 && !activeMembership) {
                return res.status(403).json({ message: appString.MEMBERSHIPCOUMPSRY });
            }

            const { membershipDiscount, deliveryCharge } = calculateMembershipBenefits(
                cart.cartTotal,
                activeMembership
            );
            
            const { finalTotal, discountAmount, appliedPromos } = await applyPromoCode(
                cart.cartTotal - membershipDiscount,
                PromoCode,
                userId,
                manualCode
            );

            const totalPayable = finalTotal + deliveryCharge;
            const paymentAmount = Math.round(totalPayable * 100); 

            const newOrder = new Order({
                userId,
                cartId: cart._id,
                items: cart.items,
                cartTotal: cart.cartTotal,
                membershipDiscount, 
                discountAmount, 
                deliveryCharge,
                payableAmount: totalPayable,
                appliedPromoCode: appliedPromos.map(p => p.code).join(", "),
                paymentMethod: settings.paymentMethod,
                shippingAddress: primaryAddress.Address,
                status: settings.paymentMethod === 2 ? 1 : 0 // 2 is likely COD/Manual
            });

            let clientSecret = null, razorpayOrderData = null;

            if (settings.paymentMethod === 1) { // STRIPE
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: paymentAmount,
                    currency: 'inr',
                    receipt_email: user?.email,
                    customer: user?.stripecustomer_Id,
                    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
                    metadata: { 
                        orderId: newOrder._id.toString(),
                        cartId: cart._id.toString() 
                    }
                });

                newOrder.stripePaymentIntentId = paymentIntent.id; 
                clientSecret = paymentIntent.client_secret;

            } else if (settings.paymentMethod === 3) { 
                razorpayOrderData = await razorpay.orders.create({
                    amount: paymentAmount,
                    currency: "INR",
                    notes: { 
                        orderId: newOrder._id.toString(), 
                        cartId: cart._id.toString() 
                    }
                });
                newOrder.razorpayOrderId = razorpayOrderData.id;
            }

            await newOrder.save();

            if (settings.paymentMethod === 2) {
                await Cart.findByIdAndDelete(cart._id);
            }

            res.status(201).json({
                message: appString.ORDERINTIATED,
                order: newOrder,
                membershipDiscount,
                promoDiscount: discountAmount,
                deliveryCharge,
                finalPayable: totalPayable,
                clientSecret,
                razorpayOrder: razorpayOrderData
            });

        } catch (err) {
            console.error("Order Creation Error:", err.message);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = orderController;
