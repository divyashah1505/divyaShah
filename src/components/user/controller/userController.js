const User = require("../model/users");
const Order = require("../model/order");
const Cart = require("../model/cart");
const {
  generateTokens,
  removeUserToken,
  success,
  error,
  calculateSubscriptionRefund,
  convertsPointsToINR,
  updateUserTotalPoints,
  calculateRewardPoints
} = require("../../utils/commonUtils");
const Category = require("../../Admin/model/category");
const { appString } = require("../../utils/appString");
const mongoose = require("mongoose");
const AddressModel = require("../model/Address");
const MembershipPlan = require("../../Admin/model/SubscriptionPlan")
const { sendEmail } = require("../../utils/emailUtils");
const emailTemplates = require("../../utils/emailTemplates")
const { sendSMS } = require("../../utils/smsService")
const { generateOTP } = require("../../utils/otpGenerate");
const path = require("path");
const userMembership = require("../model/userMembership")
const userRewards = require("../model/userRewards")
const Payment = require("../../user/model/payment")
const Product = require("../../Admin/model/product");
const config = require("../../../../config/development.js")
const stripe = require("stripe")(config.STRIPE_SECRET_KEY);
const user = require("../../user/model/users")
const userWithDrawRequestSchema = require("../model/userWithDrawaRequest.js")
const Wallet = require("../model/userWallet");
const WithdrawRequest = require("../model/userWithDrawaRequest");
const twilio = require("twilio")(config.TWILIO_SID, config.TWILIO_AUTH_TOKEN);
const ejs = require("ejs");

const userController = {
  register: async (req, res) => {
    try {
      let { username, email, mobile, password, file } = req.body;
      const contact = email || mobile;

      if (!contact) return error(res, appString.CONTACT_REQUIRED, 400);

      const contactStr = contact.toString();
      const isEmail = /.+@.+\..+/.test(contactStr);

      const { otp, otpExpires } = generateOTP();

      const customer = await stripe.customers.create({
        name: username,
        email: email,
        mobile: mobile
      });
      const userData = {
        username,
        password,
        file,
        otp,
        otpExpires,
        verified: 0,
        email: isEmail ? contactStr : undefined,
        mobile: !isEmail ? contactStr : undefined,
        stripecustomer_Id: customer.id
      };

      const user = await User.create(userData);

      if (isEmail) {
        await sendEmail(contactStr, "Account Verification OTP", emailTemplates.verificationOTP(otp));
      } else {
        await sendSMS(contactStr, otp);
      }

      return success(res, { userId: user._id, type: isEmail ? "email" : "mobile" }, appString.OTP_SENT, 201);
    } catch (err) {
      if (err.code === 11000) return error(res, `${Object.keys(err.keyValue)[0]} ${appString.ALREADY_EXISTS}`, 409);
      return error(res, err.message || appString.REGISTRATION_FAILED, 400);
    }
  },
  verifyOtp: async (req, res) => {
    try {
      const { email, mobile, otp } = req.body;
      const identifier = email || mobile;

      if (!identifier || !otp) {
        return error(res, appString.REQUIRED_FIELDS, 400);
      }

      const identifierStr = identifier.toString();

      const user = await User.findOne({
        $or: [
          { email: identifierStr },
          { mobile: identifierStr },
          { pendingEmail: identifierStr },
          { pendingMobile: identifierStr }
        ],
        otp,
        otpExpires: { $gt: new Date() },
      });

      if (!user) return error(res, appString.INVALID_OTP, 400);

      if (user.pendingEmail === identifierStr) {
        user.email = user.pendingEmail;
        user.isVerifiedByEmail = 1;
        user.pendingEmail = null;
      } else if (user.pendingMobile === identifierStr) {
        user.mobile = user.pendingMobile;
        user.isVerifiedByMobile = 1;
        user.pendingMobile = null;
      } else {
        if (user.email === identifierStr) user.isVerifiedByEmail = 1;
        if (user.mobile === identifierStr) user.isVerifiedByMobile = 1;
      }

      user.otp = null;
      user.otpExpires = null;
      await user.save();

      return success(res, null, appString.VERIFIED_SUCCESS, 200);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },
  resendOtp: async (req, res) => {
    try {
      const { email, mobile } = req.body;
      const identifier = email || mobile;

      if (!identifier) return error(res, appString.REQUIRED_FIELDS, 400);
      const identifierStr = identifier.toString();

      const user = await User.findOne({
        $or: [{ email: identifierStr }, { mobile: identifierStr }],
      });

      if (!user) return error(res, appString.USER_NOT_FOUND, 404);

      const { otp, otpExpires } = generateOTP();
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();

      if (user.email === identifierStr) {
        const emailHtml = emailTemplates.verificationOTP(otp);
        await sendEmail(user.email, "New Verification OTP", emailHtml);
      } else {
        await sendSMS(identifierStr, otp);
      }

      return success(res, null, appString.OTP_RESENT);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },
  login: async (req, res) => {
    try {
      const { email, mobile, username, password } = req.body;
      const rawContact = email || mobile || username;

      if (!rawContact || !password) return error(res, appString.Required_EmailPass, 400);
      const contact = rawContact.toString();

      const user = await User.findOne({
        $or: [{ email: contact }, { mobile: contact }, { username: contact }]
      });

      if (!user || !(await user.matchPassword(password))) {
        return error(res, appString.INVALID_CREDENTIALS, 401);
      }

      if (user.isVerifiedByEmail === 0 && user.isVerifiedByMobile === 0) {
        return error(res, appString.NOT_VERIFIED, 403);
      }

      if (user.status === 0 || user.status === "0") {
        const msg = (user.deletedBy && user.deletedBy.toString() === user._id.toString())
          ? appString.DELETDBYUSER
          : appString.DELETEDBYADMIN;
        return error(res, msg, 403);
      }

      let verifiedVia = "";
      if (contact === user.email) {
        verifiedVia = "Email";
      } else if (contact === user.mobile) {
        verifiedVia = "Mobile";
      } else {
        verifiedVia = user.isVerifiedByEmail === 1 ? "Email" : "Mobile";
      }

      const tokens = await generateTokens(user);

      return success(res, {
        userId: user._id,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        verifiedVia: verifiedVia,
        ...tokens
      }, appString.LOGIN_SUCCESS);

    } catch (err) {
      return error(res, err.message || appString.LOGIN_FAILED, 500);
    }
  },
  updateUser: async (req, res) => {
    try {
      const { email, mobile, ...otherUpdates } = req.body;
      const user = await User.findOne({ _id: req.user.id, status: 1 });

      if (!user) return error(res, appString.USER_NOT_FOUND, 404);

      let needsVerification = false;
      let verificationType = "";

      if (email && email !== user.email) {
        if (user.isVerifiedByEmail === 1) {
          return error(res, appString.EMAIL_ALREADY_VERIFIED, 400);
        }
        user.pendingEmail = email;
        needsVerification = true;
        verificationType = "email";
      }

      if (mobile && mobile !== user.mobile) {
        if (user.isVerifiedByMobile === 1) {
          return error(res, appString.MOBILE_ALREADY_VERIFIED, 400);
        }
        user.pendingMobile = mobile;
        needsVerification = true;
        verificationType = "mobile";
      }

      if (needsVerification) {
        const { otp, otpExpires } = generateOTP();
        user.otp = otp;
        user.otpExpires = otpExpires;

        const target = verificationType === "email" ? user.pendingEmail : user.pendingMobile;

        if (verificationType === "email") {
          await sendEmail(target, "Verify Your Email", emailTemplates.verificationOTP(otp));
        } else {
          await sendSMS(target, otp);
        }

        await user.save();
        return success(res, { type: verificationType }, appString.OTP_SENT_ONCE, 200);
      }

      Object.assign(user, otherUpdates);
      const updatedUser = await user.save();

      return success(res, updatedUser, appString.USER_UPDATED);
    } catch (err) {
      if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return error(res, `${field} ${appString.ALREADY_EXISTS}`, 409);
      }
      return error(res, err.message, 400);
    }
  },
  getProfile: async (req, res) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.user.id);

      const profile = await User.aggregate([
        {
          $match: {
            _id: userId,
            status: { $nin: ["deleted_by_user", "deleted_by_admin"] },
          },
        },
        {
          $lookup: {
            from: "addresses",
            localField: "_id",
            foreignField: "userId",
            as: "primaryAddress",
          },
        },
        {
          $set: {
            primaryAddress: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$primaryAddress",
                    as: "addr",
                    cond: { $eq: ["$$addr.isPrimary", 1] },
                  },
                },
                0,
              ],
            },
          },
        },
        {
          $project: {
            username: 1,
            email: 1,
            totalPoints: 1,
            primaryAddress: 1,
          },
        },
      ]);

      if (!profile.length) {
        return error(res, "User not found", 404);
      }

      return success(res, profile[0]);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },

  deleteUser: async (req, res) => {
    try {
      const user = await User.findOneAndUpdate(
        { _id: req.user.id, status: 1 },
        {
          status: 0,
          deletedBy: req?.user?.id,
        },
        { new: true },
      );

      if (!user) return error(req, res, appString.INACTIVE, 400);
      return success(res, {}, appString.USER_DELETED);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  logout: async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return error(res, "No token provided", 400);
      }

      await removeUserToken(req.user.id, token);
      return success(res, {}, appString.LOGOUT_SUCCESS);
    } catch (err) {
      return error(res, appString.LOGOUT_FAILED, 500);
    }
  },
  insertAddress: async (req, res) => {
    try {
      const userId = req.user.id;
      const { Address, isPrimary } = req.body;

      const isPrimaryBool = Number(isPrimary) === 1;

      if (isPrimaryBool) {
        await AddressModel.updateMany(
          { userId, isPrimary: true },
          { isPrimary: false },
        );
      }

      const address = await AddressModel.create({
        userId,
        Address,
        isPrimary: isPrimaryBool,
      });

      if (isPrimaryBool) {
        await User.findByIdAndUpdate(userId, {
          primaryAddress: address._id,
        });
      }

      return success(res, address, appString.ADDRESS_CREATED, 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },
  listUserAddresses: async (req, res) => {
    try {
      const addresses = await AddressModel.find({ userId: req.user.id });
      return success(res, addresses);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },
  changePrimaryAddress: async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId } = req.body;

      await AddressModel.updateMany(
        { userId, isPrimary: true },
        { isPrimary: false },
      );

      const address = await AddressModel.findOneAndUpdate(
        { _id: addressId, userId },
        { isPrimary: true },
        { new: true },
      );

      if (!address) {
        return error(res, appString.ANOT_FOUND, 404);
      }

      await User.findByIdAndUpdate(userId, {
        primaryAddress: address._id,
      });

      return success(res, address, appString.PRIMARY_ADDRESS_UPDATED);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },
  changePassword: async (req, res) => {
    try {
      const { oldPassword, newPassword, confirmPassword } = req.body;

      if (newPassword !== confirmPassword) {
        return error(res, appString.DOESNOTMATCH, 400);
      }

      const user = await User.findById(req.user.id);
      if (!user || !(await user.matchPassword(oldPassword))) {
        return error(res, appString.INCORRECTPASSWORD, 401);
      }

      if (oldPassword === newPassword) {
        return error(res, appString.ALREDYUSEPASSWORD, 400);
      }

      user.password = newPassword;
      await user.save();

      return success(res, {}, appString.CHANGEPASSWORD);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) return error(res, appString.NOT_FOUND, 404);

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otp = otp;
      user.otpExpires = Date.now() + 1 * 60 * 1000;
      await user.save();

      const templatePath = path.join(
        __dirname,
        "../../../views/otpTemplate.ejs",
      );
      const html = await ejs.renderFile(templatePath, {
        username: user.username,
        otp,
      });

      await sendEmail(user.email, appString.RESETOTP, html);
      return success(res, {}, appString.SENTOTP);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },

  verifyResetOtp: async (req, res) => {
    try {
      const { email, otp } = req.body;
      const user = await User.findOne({ email, otp });

      if (!user) {
        return error(res, appString.INVALID_OTP, 400);
      }

      if (user.otpExpires < Date.now()) {
        return error(res, appString.EXPIREDOTP, 400);
      }

      return success(res, {}, "OTP verified successfully");
    } catch (err) {
      return error(res, err.message, 500);
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { email, otp, newPassword, confirmPassword } = req.body;

      if (newPassword !== confirmPassword) {
        return error(res, appString.DOESNOTMATCH, 400);
      }

      const user = await User.findOne({ email, otp });

      if (!user) {
        return error(res, appString.INVALID_OTP, 400);
      }

      if (user.otpExpires < Date.now()) {
        user.otp = null;
        user.otpExpires = null;
        await user.save();
        return error(res, appString.EXPIREDOTP, 400);
      }

      const isSamePassword = await user.matchPassword(newPassword);
      if (isSamePassword) {
        return error(res, appString.ALREDYUSEPASSWORD, 400);
      }

      user.password = newPassword;
      user.otp = null;
      user.otpExpires = null;
      await user.save();

      return success(res, {}, appString.RESETOTPSUCCESS);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  initiatesSubscription: async (req, res, next) => {
    try {
      const userId = req?.user?.id;
      const { memberShipId } = req.body;

      if (!userId) return res.status(400).json({ message: "User ID is missing." });

      const userDocument = await User.findById(userId);
      if (!userDocument) return res.status(404).json({ message: "User not found" });

      const plan = await MembershipPlan.findById(memberShipId);
      if (!plan || plan.is_active === 0) return res.status(404).json({ message: "Plan not found" });

      // Check for existing active membership and return structured info for frontend to handle
      const activeSub = await userMembership.findOne({ userId: userId, status: 1 }).populate('membership_id');
      if (activeSub) {
        const activePlanName = activeSub.membership_id?.name || activeSub.membershipDetails?.name || 'your current plan';
        return res.status(400).json({
          message: "Already have an active membership",
          activePlanName: activePlanName,
          code: "ACTIVE_MEMBERSHIP"
        });
      }

      // Append {CHECKOUT_SESSION_ID} so frontend can verify payment without relying on webhook
      const baseSuccessUrl = req.body.successUrl || 'http://localhost:3001/plans?payment=success';
      const successUrlWithSession = `${baseSuccessUrl}&session_id={CHECKOUT_SESSION_ID}`;

      const session = await stripe.checkout.sessions.create({
        client_reference_id: userId.toString(),
        customer: userDocument.stripecustomer_Id,
        payment_method_types: ['card'],
        mode: "subscription",
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        success_url: successUrlWithSession,
        cancel_url: req.body.cancelUrl || 'http://localhost:3001/plans',
      });

      // Create a pending record
      await userMembership.create({
        stripecustomer_Id: userDocument.stripecustomer_Id,
        userId: userId,
        membership_id: memberShipId,
        membershipDetails: plan,
        status: 0,
        sessionId: session.id
      });

      return res.status(200).json({ status: "success", data: session });
    } catch (err) {
      console.error("Initiate Subscription Error:", err.message);
      next(err);
    }
  },

  createwithdrawalrequest: async (req, res) => {
    try {
      const userId = req?.user?.id;
      const { pointsToWithdraw } = req.body;

      if (!pointsToWithdraw || pointsToWithdraw < 500) {
        return res.status(400).json({ error: appString.POINTSLIMIT });
      }

      const activeMembership = await userMembership
        .findOne({ userId, status: 1, endDate: { $gt: new Date() } })
        .populate("membership_id");

      if (!activeMembership) {
        return res.status(403).json({ error: appString.ACTIVEMEMBERSHIPREQUIRED });
      }

      const plan = activeMembership.membership_id;
      const userDoc = await User.findById(userId);

      if (!userDoc || userDoc.totalPoints < pointsToWithdraw) {
        return res.status(400).json({ error: appString.INSUFFICIENTREWARDPOINTS });
      }

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyRequests = await WithdrawRequest.find({
        userId,
        createdAt: { $gte: startOfMonth },
        status: { $ne: 2 }
      });

      const convertedAmount = pointsToWithdraw / 10;
      const monthlyTotalAmount = monthlyRequests.reduce((sum, r) => sum + r.totalAmount, 0);

      if (plan.monthlyLimit && (monthlyTotalAmount + convertedAmount > plan.monthlyLimit)) {
        return res.status(400).json({ error: `Monthly limit ₹${plan.monthlyLimit} exceeded.` });
      }

      let fee = 0;
      const freeAllowed = plan.freeWithdrawalsPerMonth || 0;

      if (monthlyRequests.length >= freeAllowed) {
        const feePercent = plan.withdrawalFeePercentage || 0;
        fee = convertedAmount * (feePercent / 100);
      }

      const finalAmount = convertedAmount - fee;

      const withdraw = await WithdrawRequest.create({
        userId,
        membership_id: plan._id,
        pointRequestForWithdraw: pointsToWithdraw,
        totalAmount: convertedAmount,
        processingFee: fee,
        rewardableAmount: finalAmount,
        priority: plan.ispriority || 0,
        status: 0
      });

      userDoc.totalPoints -= pointsToWithdraw;
      await userDoc.save();

      // ✅ Sync wallet balance
      await updateUserTotalPoints(userId);

      return res.json({
        message: appString.WITHDRAWREQUEST,
        data: withdraw
      });

    } catch (error) {
      console.error("Withdrawal Error:", error);
      res.status(500).json({ error: appString.SERVERERROR });
    }
  },

  // Called by frontend after Stripe redirects back — activates pending membership
  // without relying on the Stripe webhook (needed for local dev where webhooks can't reach localhost)
  verifySubscription: async (req, res) => {
    try {
      const userId = req.user?.id;
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ success: false, message: 'sessionId query param is required' });
      }

      // Retrieve the full session from Stripe, expanding subscription + invoice + payment_intent
      const stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'subscription.latest_invoice', 'subscription.latest_invoice.payment_intent']
      });

      if (stripeSession.payment_status !== 'paid') {
        return res.status(400).json({ success: false, message: 'Payment not completed yet' });
      }

      // Find the pending membership for this session
      let membership = await userMembership
        .findOne({ userId, sessionId, status: 0 })
        .populate('membership_id');

      if (!membership) {
        // Webhook may have already activated it — try fetching the active one
        const already = await userMembership
          .findOne({ userId, status: 1 })
          .populate('membership_id');
        if (already) {
          return res.status(200).json({ success: true, data: already, alreadyActive: true });
        }
        return res.status(404).json({ success: false, message: 'No pending membership found for this session' });
      }

      const plan = membership.membership_id || await MembershipPlan.findById(membership.membership_id);
      const sub = stripeSession.subscription;
      const subId = typeof sub === 'object' ? sub.id : sub;
      const latestInvoice = typeof sub === 'object' ? sub.latest_invoice : null;
      const chargeId = latestInvoice?.charge || null;
      const piObj = latestInvoice?.payment_intent;
      const paymentIntentId = (typeof piObj === 'object' ? piObj?.id : piObj) || null;

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (plan?.duration_months || 1));

      // Activate the membership
      const activated = await userMembership.findByIdAndUpdate(
        membership._id,
        {
          $set: {
            status: 1,
            paymentstatus: 1,
            stripe_subscription_id: subId,
            startDate,
            endDate,
            last_charge_id: chargeId,
            paymentIntentId,
            is_first_order_after_membership: 1
          }
        },
        { new: true }
      ).populate('membership_id');

      // Create / update the Payment record
      const orderRef = `ORD-${Date.now()}`.toUpperCase();
      await Payment.findOneAndUpdate(
        { orderId: membership._id },
        {
          $set: {
            orderId: membership._id,
            userId,
            order_reference: orderRef,
            chargeId: chargeId || '',
            stripePaymentIntentId: paymentIntentId || `session_${sessionId}`,
            amount: stripeSession.amount_total / 100,
            currency: stripeSession.currency || 'usd',
            status: 1,
            paymentMethodType: 1,
            stripecustomer_Id: stripeSession.customer,
            rawDetails: { sessionId }
          }
        },
        { upsert: true, new: true }
      );

      console.log(`[verifySubscription] Membership ${membership._id} activated for user ${userId}`);

      // ✅ Credit Reward Points for Membership Purchase (Slab-based)
      let pointsEarned = 0;
      if (plan && plan.rewards) {
        // Use false for isFirstOrder to give slab points for the membership purchase itself
        pointsEarned = calculateRewardPoints(plan, stripeSession.amount_total / 100, false);
      }

      if (pointsEarned > 0) {
        await User.findByIdAndUpdate(userId, { $inc: { totalPoints: pointsEarned } });
        await updateUserTotalPoints(userId);

        await userRewards.findOneAndUpdate(
          { membership_id: activated._id },
          {
            $set: {
              userId,
              membership_id: activated._id,
              paymentIntentId: paymentIntentId || `session_${sessionId}`,
              totalPoints: pointsEarned
            }
          },
          { upsert: true }
        );
        console.log(`[verifySubscription] ${pointsEarned} slab points credited for membership.`);
      }

      return res.status(200).json({ success: true, data: activated });

    } catch (err) {
      console.error('[verifySubscription] Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  cancelMembership: async (req, res) => {
    try {
      const userId = req.user?.id;

      // 1. Find the active membership
      const subscription = await userMembership.findOne({ userId, status: 1 }).populate('membership_id');
      if (!subscription) {
        return res.status(404).json({ success: false, message: appString.NOACTIVE || "No active membership found" });
      }

      // 2. Check if already cancelled/refunded
      if (subscription.refunded === 1) {
        return res.status(400).json({ success: false, message: "This subscription has already been refunded" });
      }

      // 3. Determine the plan price for refund calculation
      //    Priority: populated plan price → membershipDetails price → payment record amount
      let planPrice = subscription.membership_id?.price
        || subscription.membershipDetails?.price
        || null;

      if (!planPrice) {
        // Fallback: look up the payment record
        const paymentRecord = await Payment.findOne({ userId, status: 1 }).sort({ createdAt: -1 });
        if (paymentRecord) planPrice = paymentRecord.amount;
      }

      if (!planPrice || isNaN(planPrice)) {
        return res.status(400).json({ success: false, message: "Unable to determine plan price for refund calculation" });
      }

      // 4. Calculate pro-rata refund based on days used
      //    Uses startDate (when membership became active) from subscription.startDate or subscription.createdAt
      const refundStartDate = subscription.startDate || subscription.createdAt;
      const refundDetails = calculateSubscriptionRefund(planPrice, refundStartDate);

      if (!refundDetails || isNaN(parseFloat(refundDetails.finalRefundAmount))) {
        return res.status(400).json({ success: false, message: "Could not calculate a valid refund amount" });
      }

      const walletRefundAmount = parseFloat(refundDetails.finalRefundAmount);

      // 5. Cancel the Stripe subscription to stop future billing
      //    (We do NOT issue a Stripe card refund — money goes to the user's wallet)
      if (subscription.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
          console.log(`[CANCEL] Stripe subscription ${subscription.stripe_subscription_id} cancelled`);
        } catch (stripeErr) {
          if (stripeErr.type === 'StripeInvalidRequestError' && stripeErr.message.includes('No such subscription')) {
            console.log(`[CANCEL] Stripe subscription already cancelled: ${subscription.stripe_subscription_id}`);
          } else {
            // Non-fatal: log but continue so we still credit the wallet
            console.error(`[CANCEL] Stripe cancel error (non-fatal): ${stripeErr.message}`);
          }
        }
      }

      // 6. Credit refund amount to user's Wallet
      if (walletRefundAmount > 0) {
        await Wallet.findOneAndUpdate(
          { userId },
          {
            $inc: { totalWithdraw_amount: walletRefundAmount },
            $setOnInsert: { totalReward_Points: 0 }
          },
          { upsert: true, new: true }
        );
        console.log(`[CANCEL] Wallet credited ₹${walletRefundAmount} for user ${userId}`);
      }

      // 7. Mark membership as cancelled in DB
      const updatedMembership = await userMembership.findByIdAndUpdate(
        subscription._id,
        {
          $set: {
            status: 2,          // 2 = cancelled
            paymentstatus: 2,
            refunded: 1,
            actual_refunded_amount: walletRefundAmount,
            canceledAt: new Date()
          }
        },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        message: `Membership cancelled. ₹${walletRefundAmount.toFixed(2)} has been credited to your wallet.`,
        walletRefundAmount: walletRefundAmount.toFixed(2),
        refundBreakdown: {
          planPrice: planPrice,
          daysUsed: refundDetails.daysUsed || 0,
          daysRemaining: refundDetails.daysRemaining,
          grossRefund: refundDetails.grossRefund,
          cancellationFee: refundDetails.cancellationFee,
          finalRefundAmount: refundDetails.finalRefundAmount
        },
        updatedMembership
      });

    } catch (err) {
      console.error("[cancelMembership] Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getActiveCategories: async (req, res) => {
    try {
      const { search } = req.query;
      const regex = search ? new RegExp(search, "i") : null;

      const categories = await Category.aggregate([
        {
          $match: {
            categoryId: null,
            status: 1,
            isDeleted: { $ne: 1 },
            ...(regex && { name: regex }),
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "categoryId",
            as: "sub",
          },
        },
        {
          $addFields: {
            subcategories: {
              $filter: {
                input: "$sub",
                as: "s",
                cond: {
                  $and: [
                    { $eq: ["$$s.status", 1] },
                    { $ne: ["$$s.isDeleted", 1] }
                  ]
                }
              },
            },
          },
        },
        {
          $project: {
            name: 1,
            description: 1,
            image: 1,
            subcategories: {
              _id: 1,
              name: 1,
              image: 1,
            },
          },
        },
      ]);

      return success(res, categories, "Active categories fetched");
    } catch (err) {
      return error(res, err.message, 500);
    }
  },

  getSubscriptionPlans: async (req, res) => {
    try {
      const plans = await MembershipPlan.find({ is_active: 1 })
        .sort({ plan_type: 1 })
        .lean();

      if (!plans || plans.length === 0) {
        return error(res, "No active plans found", 404);
      }

      const formattedPlans = plans.map(plan => ({
        _id: plan._id,
        name: plan.name,
        price: plan.price,
        duration_months: plan.duration_months,
        discount_percent: plan.discount_percent,
        max_discount_limit: plan.max_discount_limit,
        min_order_amount: plan.min_order_amount,
        free_delivery: plan.free_delivery,
        free_delivery_min_amount: plan.free_delivery_min_amount,
        rewards: plan.rewards,
        minPoints: plan.minPoints,
        freeRequests: plan.freeRequests,
        monthlyLimit: plan.monthlyLimit
      }));

      return success(res, formattedPlans, "Subscription plans fetched successfully");
    } catch (err) {
      return error(res, err.message, 500);
    }
  },

  mySubscription: async (req, res, next) => {
    try {
      const userId = req.user?.id;

      const activeMembership = await userMembership
        .findOne({ userId: userId, status: 1 })
        .populate('membership_id');

      if (!activeMembership) {
        return res.status(200).json({ success: true, data: null });
      }

      return res.status(200).json({ success: true, data: activeMembership });

    } catch (error) {
      console.error("Error fetching mySubscription:", error);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  getProductsBySubCategory: async (req, res) => {
    try {
      const { categoryId } = req.params;

      const subCategory = await Category.findById(categoryId);
      if (!subCategory || subCategory.status !== 1) {
        return error(res, appString.SUBCATEGORYNOTFOUND, 404);
      }

      const products = await Product.find({ categoryId, status: 1 }).lean();

      const formattedProducts = products.map((product) => {
        const variants = Array.isArray(product.variants) ? product.variants : [];
        const prices = variants.map(v => v.price).filter(p => typeof p === "number");

        return {
          _id: product._id,
          name: product.name,
          description: product.description,
          image: product.images?.[0] || null,
          images: product.images || [],
          categoryId: product.categoryId,
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
          variants: variants,
        };
      });

      return success(res, formattedProducts, "Products fetched successfully");
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  madePayment: async (req, res) => {
    try {
      const { paymentIntentId, orderId } = req.body;

      if (!paymentIntentId || !orderId) {
        return res.status(400).json({ success: false, message: "Missing required parameters" });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        const updatedOrder = await Order.findOneAndUpdate(
          { _id: orderId, status: 0 },
          { $set: { status: 1, stripePaymentIntentId: paymentIntentId } },
          { new: true }
        );

        if (updatedOrder) {
          await Cart.findByIdAndDelete(updatedOrder.cartId);

          if (updatedOrder.items?.length > 0) {
            const { deductStock } = require("../../utils/inventoryUtils");
            const invPromises = updatedOrder.items.map(async (item) => {
              await deductStock(item.productId, item.variantId, item.quantity);
            });
            await Promise.all(invPromises);
          }

          if (updatedOrder.walletAmountUsed > 0) {
            await Wallet.findOneAndUpdate(
              { userId: updatedOrder.userId },
              { $inc: { totalWithdraw_amount: -updatedOrder.walletAmountUsed } }
            );
            console.log(`Wallet deducted: ₹${updatedOrder.walletAmountUsed} for User: ${updatedOrder.userId}`);
          }

          // ✅ Credit Reward Points
          const userId = updatedOrder.userId;
          const cartTotal = paymentIntent.amount_received / 100;

          const activeMembership = await userMembership
            .findOne({ userId, status: 1 })
            .populate('membership_id');

          let pointsEarned = 0;
          let planIdForRewards = null;

          if (activeMembership && activeMembership.membership_id) {
            const plan = activeMembership.membership_id;
            planIdForRewards = plan._id;

            const isFirstAfterMembership = activeMembership.is_first_order_after_membership === 1;

            pointsEarned = calculateRewardPoints(
              plan,
              cartTotal,
              isFirstAfterMembership
            );

            if (isFirstAfterMembership) {
              await userMembership.findByIdAndUpdate(activeMembership._id, {
                $set: { is_first_order_after_membership: 0 }
              });
            }
          }

          if (pointsEarned > 0) {
            const existingReward = await userRewards.findOne({ orderId: updatedOrder._id });
            if (!existingReward) {
              await userRewards.findOneAndUpdate(
                { orderId: updatedOrder._id },
                { $set: { userId, paymentIntentId, membership_id: planIdForRewards, totalPoints: pointsEarned } },
                { upsert: true }
              );

              await User.findByIdAndUpdate(userId, { $inc: { totalPoints: pointsEarned } });
              await updateUserTotalPoints(userId);
              console.log(`[madePayment] ${pointsEarned} points credited for Order ${updatedOrder._id}`);
            }
          }
        }

        return res.status(200).json({ success: true, message: "Payment verified successfully" });
      } else {
        return res.status(400).json({ success: false, message: "Payment not successful" });
      }
    } catch (err) {
      console.error("madePayment error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },

  getWallet: async (req, res) => {
    try {
      const userId = req.user.id;
      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        return success(res, {
          totalReward_Points: 0,
          totalWithdraw_amount: 0
        });
      }

      return success(res, wallet);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
};

module.exports = userController;
