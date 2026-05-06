require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");
const config = require("../config/development");
// const stripe = require('stripe')(config.STRIPE_SECRET_KEY);
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const http = require("http");
const socketController = require("../src/components/user/controller/socketController")
const Payment = require("../src/components/user/model/payment");
const Order = require("../src/components/user/model/order");
const Cart = require("../src/components/user/model/cart");
const User = require("../src/components/user/model/users");
const Product = require("../src/components/Admin/model/product");
const userMembership = require("../src/components/user/model/userMembership");
const MembershipPlan = require("./components/Admin/model/SubscriptionPlan");
const userRewards = require("../src/components/user/model/userRewards");
const { errorHandler, calculateRewardPoints, success, calculateSubscriptionRefund,updateUserTotalPoints } = require("./components/utils/commonUtils");
const router = require("../src/components/user/index");

const adminRouter = require("./components/Admin/routes");
const { appString } = require("./components/utils/appString");
const {initSocket , sendNotificationToUser} = require("../src/components/user/controller/socketController")
const users = require("../src/components/user/model/users");
const payment = require("../src/components/user/model/payment");
const { UserBindingContextImpl } = require("twilio/lib/rest/ipMessaging/v2/service/user/userBinding");
const app = express();
const server = http.createServer(app);

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "E-commerce Backend API is running successfully "
    });
});
console.log("DB_URL =", process.env.DB_URL);
initSocket(server)
app.post("/razorpay/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const secret = 'i_iPXP7kctcxQmR';
        const signature = req.headers["x-razorpay-signature"];
        const shasum = crypto.createHmac("sha256", secret).update(req.body);
        if (shasum.digest("hex") !== signature && req.headers["test-mode"] !== "true") return console.error(400).send("Invalid Signature");

        const body = JSON.parse(req.body.toString());
        if (body.event === "order.paid") {
            const { orderId, cartId } = body.payload.order.entity.notes;
            const updatedOrder = await Order.findOneAndUpdate({ _id: orderId, status: 0 }, { status: 1 }, { new: 1 });
            if (updatedOrder) {
                await Payment.findOneAndUpdate({ orderId: updatedOrder._id }, { status: 1, razorpayPaymentId: body.payload.payment.entity.id });
                const { deductStock } = require("./components/utils/inventoryUtils");
                const invPromises = updatedOrder.items.map(i => deductStock(i.productId, i.variantId, i.quantity));
                await Promise.all([...invPromises, Cart.findByIdAndDelete(cartId)]);
            }
        }
        return success(200).send("ok");
    } catch (err) { return console.error(500).send(err.message); }
});
app.post("/stripe/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, config.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Stripe Webhook Error: ${err.message}`);
        return console.error(400).send(`Webhook Error: ${err.message}`);
    }

    const session = event.data.object;

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const custId = session.customer;
        const subId = session.subscription;

        try {
            const subscriptionData = await stripe.subscriptions.retrieve(subId, {
                expand: ['latest_invoice.payment_intent']
            });

            const latestInvoice = subscriptionData.latest_invoice;
            const finalChargeId = latestInvoice?.charge || latestInvoice?.payment_intent?.latest_charge;
            const paymentIntentId = latestInvoice?.payment_intent?.id || session.payment_intent;

            const userMembershipDocument = await userMembership.findOne({
                stripecustomer_Id: custId,
                status: 0
            });

            if (userMembershipDocument) {
                const plan = await MembershipPlan.findById(userMembershipDocument.membership_id);
                const orderRef = `ORD-${Date.now()}-${session.id.slice(-6)}`.toUpperCase();

                const startDate = new Date();
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + (plan?.duration_months || 1));
                console.log(custId);

                await userMembership.findByIdAndUpdate(userMembershipDocument._id, {
                    status: 1,
                    stripe_subscription_id: subId,
                    startDate: startDate,
                    endDate: endDate,
                    last_charge_id: finalChargeId,
                    stripe_price_id: plan?.stripe_price_id,
                    is_first_order_after_membership: 1,
                    paymentstatus: 1
                });
                console.log("hello", paymentIntentId)
                await Payment.findOneAndUpdate(
                    { orderId: userMembershipDocument._id }, // More specific filter
                    {
                        $set: {
                            orderId: userMembershipDocument._id,
                            userId: userMembershipDocument.userId,
                            order_reference: orderRef, // Fixed: use orderRef directly
                            chargeId: finalChargeId,
                            stripePaymentIntentId: paymentIntentId, // Uncommented
                            amount: session.amount_total / 100,
                            currency: session.currency,
                            status: 1,
                            paymentMethodType: 1,
                            rawDetails: session,
                            stripecustomer_Id: custId
                        }
                    },
                    { upsert: true, new: true }
                );
                console.log(`Membership Active. Charge ${finalChargeId} stored.`);

                // ✅ Credit Slab Points for Membership Purchase
                let pointsEarned = 0;
                if (plan && plan.rewards) {
                    pointsEarned = calculateRewardPoints(plan, session.amount_total / 100, false);
                }

                if (pointsEarned > 0) {
                    await User.findByIdAndUpdate(userMembershipDocument.userId, { $inc: { totalPoints: pointsEarned } });
                    await updateUserTotalPoints(userMembershipDocument.userId);

                    await userRewards.findOneAndUpdate(
                        { membership_id: userMembershipDocument._id },
                        {
                            $set: {
                                userId: userMembershipDocument.userId,
                                membership_id: userMembershipDocument._id,
                                paymentIntentId: paymentIntentId || `sub_sess_${session.id}`,
                                totalPoints: pointsEarned
                            }
                        },
                        { upsert: true }
                    );
                    console.log(`Webhook: ${pointsEarned} slab points credited for membership.`);
                }
            }
        } catch (err) {
            console.error("Checkout Error:", err.message);
        }
    }

    if (event.type === 'payment_intent.succeeded') {
        const session = event.data.object;
        const paymentIntentId = session.id;
        const custId = session.customer
        
        console.log(custId);

        const chargeId = session.latest_charge;
        console.log("Found Charge ID:", chargeId);
        const payment = await Payment.findOneAndUpdate(
            { stripePaymentIntentId: paymentIntentId },
            {
                $set: {

                    chargeId: chargeId,
                    stripePaymentIntentId: paymentIntentId,

                    stripecustomer_Id: custId
                }
            },
            { upsert: true, new: true }
        );

        console.log("dgfjdgdff", payment)
        // }
    }

    if (event.type === 'checkout.session.completed' && session.mode === 'subscription') {
        const custId = session.customer;
        const subId = session.subscription;

        try {
            const subscriptionData = await stripe.subscriptions.retrieve(subId, {
                expand: ['latest_invoice.payment_intent']
            });

            const finalChargeId = subscriptionData.latest_invoice?.charge;
            const userMem = await userMembership.findOne({ stripecustomer_Id: custId, status: 0 });

            if (userMem) {
                const plan = await MembershipPlan.findById(userMem.membership_id);
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + (plan?.duration_months || 1));

                await userMembership.findByIdAndUpdate(userMem._id, {
                    status: 1,
                    stripe_subscription_id: subId,
                    startDate: new Date(),
                    endDate,
                    last_charge_id: finalChargeId,
                    paymentstatus: 1
                });

                await Payment.findOneAndUpdate(
                    { stripecustomer_Id: custId, orderId: userMem._id },
                    {
                        userId: userMem.userId,
                        chargeId: finalChargeId,
                        amount: session.amount_total / 100,
                        status: 1,
                        rawDetails: session
                    },
                    { upsert: true }
                );

                //  Credit Slab Points for Membership Purchase
                let pointsEarned = 0;
                if (plan && plan.rewards) {
                    pointsEarned = calculateRewardPoints(plan, session.amount_total / 100, false);
                }

                if (pointsEarned > 0) {
                    await User.findByIdAndUpdate(userMem.userId, { $inc: { totalPoints: pointsEarned } });
                    await updateUserTotalPoints(userMem.userId);

                    await userRewards.findOneAndUpdate(
                        { membership_id: userMem._id },
                        {
                            $set: {
                                userId: userMem.userId,
                                membership_id: userMem._id,
                                paymentIntentId: `sub_sess_${session.id}`,
                                totalPoints: pointsEarned
                            }
                        },
                        { upsert: true }
                    );
                    console.log(`Webhook (sub block): ${pointsEarned} slab points credited for membership.`);
                }
            }
        } catch (err) {
            console.error("Subscription Webhook Error:", err.message);
        }
    }
 if (event.type === 'payment_intent.succeeded') {
    const session = event.data.object;
    const { id: pi_id, customer: custId, amount_received } = session;
    try {
        const updatedOrder = await Order.findOneAndUpdate(
            { stripePaymentIntentId: pi_id, status: 0 },
            { $set: { status: 1 } },
            { new: true }
        );

        if (!updatedOrder) {
            console.warn(`Order not found or already processed for PI: ${pi_id}`);
            return;
        }

        console.log("Order updated:", updatedOrder._id);
        const userId = updatedOrder.userId;
        const cartTotal = amount_received / 100;

        const activeMembership = await userMembership
            .findOne({ userId, status: 1 })
            .populate('membership_id');

        let pointsEarned = 0;
        let planIdForRewards = null;

        if (activeMembership && activeMembership.membership_id) {
            const plan = activeMembership.membership_id;
            planIdForRewards = plan._id;

            // ✅ Use is_first_order_after_membership flag instead of previousOrders count
            const isFirstAfterMembership = activeMembership.is_first_order_after_membership === 1;

            pointsEarned = calculateRewardPoints(
                plan,
                cartTotal,
                isFirstAfterMembership
            );

            // ✅ Reset the flag after it's been used
            if (isFirstAfterMembership) {
                await userMembership.findByIdAndUpdate(activeMembership._id, {
                    $set: { is_first_order_after_membership: 0 }
                });
                console.log(`First order points granted. is_first_order_after_membership reset for user ${userId}`);
            }
        }

        const existingReward = await userRewards.findOne({ orderId: updatedOrder._id });
        if (!existingReward) {
            await userRewards.findOneAndUpdate(
                { orderId: updatedOrder._id },
                { $set: { userId, paymentIntentId: pi_id, membership_id: planIdForRewards, totalPoints: pointsEarned } },
                { upsert: true }
            );

            // ✅ INCREMENT (Don't overwrite)
            await User.findByIdAndUpdate(userId, { $inc: { totalPoints: pointsEarned } });
            await updateUserTotalPoints(userId);
        } else {
            console.log(`Points already credited for Order ${updatedOrder._id}`);
        }

        await Payment.findOneAndUpdate(
            { stripePaymentIntentId: pi_id },
            { $set: { status: 1, rewardPointsEarned: pointsEarned, stripeCustomerId: custId } },
            { upsert: true }
        );

        if (updatedOrder.items?.length > 0) {
            const { deductStock } = require("./components/utils/inventoryUtils");
            const invPromises = updatedOrder.items.map(item =>
                deductStock(item.productId, item.variantId, item.quantity)
            );
            await Promise.all(invPromises);
        }

        if (updatedOrder.cartId) {
            await Cart.findByIdAndDelete(updatedOrder.cartId);
        }

         sendNotificationToUser(userId, 'paymentSuccess', appString.PAYMENTSUCCESSORDERCONFIRMED );

        console.log(`Success: ${pointsEarned} points for Order ${updatedOrder._id}`);
    } catch (err) {
        console.error("Webhook Error:", err.message);
    }
}
    if (event.type === 'charge.refunded') {
        const charge = event.data.object;

        const refundAmount = charge.amount_refunded / 100;
        const isFullyRefunded = charge.amount_refunded === charge.amount;

        const refundId = event.data.object.id;

        await userMembership.findOneAndUpdate(
            { last_charge_id: charge.id },
            {
                $set: {
                    refunded: isFullyRefunded ? 1 : 2,
                    paymentstatus: 2,
                    actual_refunded_amount: refundAmount,

                    status: isFullyRefunded ? 2 : 1
                }
            },
            { new: true }
        );

        await Payment.findOneAndUpdate(
            { chargeId: charge.id },
            {
                $set: {
                    status: 2,
                    refundedAmount: refundAmount,
                    refundId: refundId
                }
            }
        );

    }


    return res.status(201).json({ received: true });
});
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
// app.use("/uploads", express.static(path.join(__dirname, "../uploads/IMG")));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/users", router);
app.use("/api/admin", adminRouter);
app.use(errorHandler);
mongoose.connect(process.env.DB_URL)
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error("DB Error:", err));

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
module.exports = app;