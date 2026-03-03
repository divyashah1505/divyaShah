const User = require("../model/users");
const {
  generateTokens,
  removeUserToken,
  success,
  error,
  calculateSubscriptionRefund,
  convertPointsToINR
} = require("../../utils/commonUtils");
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
const config = require("../../../../config/development.json")
const stripe = require("stripe")(config.STRIPE_SECRET_KEY);
const user = require("../../user/model/users")
const userWithDrawRequestSchema = require("../model/userWithDrawaRequest.js")
const Wallet = require("../model/userWallet");
const WithdrawRequest = require("../model/userWithDrawaRequest");
const twilio = require("twilio")(config.TWILIO_SID, config.TWILIO_AUTH_TOKEN);
const ejs = require("ejs");
// const { default: customers } = require("razorpay/dist/types/customers");
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
      console.log("customerId:", customer.id);

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

      const activeSub = await userMembership.findOne({ userId: userId, status: 1 });
      if (activeSub) return res.status(400).json({ message: "Already have an active membership" });

      const session = await stripe.checkout.sessions.create({
        client_reference_id: userId.toString(),
        customer: userDocument.stripecustomer_Id,
        payment_method_types: ['card'],
        mode: "subscription",
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        success_url: "http://127.0.0.1",
        cancel_url: "http://127.0.0.1",
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


  cancelMembership: async (req, res) => {
    try {
      const userId = req.user?.id;
      const subscription = await userMembership.findOne({ userId, status: 1 });
      if (!subscription) return res.status(404).json({ success: false, message: appString.NOACTIVE });

      const paymentRecord = await Payment.findOne({ userId, status: 1 }).sort({ createdAt: -1 });
      if (!paymentRecord) throw new Error("Payment record not found");

      if (paymentRecord.refunded === 1) {
        return res.status(400).json({ success: false, message: "Already refunded" });
      }
      console.log(paymentRecord?.chargeId)

      const refundDetails = calculateSubscriptionRefund(paymentRecord.amount, subscription.createdAt);
      const refundAmountInCents = Math.round(parseFloat(refundDetails.finalRefundAmount) * 100);

      let refundId = null;
      const refund = await stripe.refunds.create({
        charge: paymentRecord.chargeId,
        amount: refundAmountInCents,
      });
      console.log(refund);

      refundId = refund.id;


      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (error) {
        if (error.type === 'StripeInvalidRequestError' && error.message.includes('No such subscription')) {
          console.log(`Subscription ${subscription.stripe_subscription_id} already canceled in Stripe, proceeding with local update.`);
        } else {
          throw error;
        }
      }


      const updatedMembership = await userMembership.findByIdAndUpdate(
        subscription._id,
        {
          $set: {
            status: 2,
            paymentstatus: 2,
            refunded: 1,
            actual_refunded_amount: parseFloat(refundDetails.finalRefundAmount),
            last_refund_id: refundId,
            canceledAt: new Date()
          }
        },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        refundAmount: refundDetails.finalRefundAmount,
        refunded: !!refundId,
        updatedData: updatedMembership
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
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
      const user = await User.findById(userId);

      if (!user || user.totalPoints < pointsToWithdraw) {
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

      if (monthlyRequests.length >= 2) {
        return res.status(400).json({ error: appString.MAXIUMLIMIT });
      }

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
        priority: plan.ispriority || 1,
        status: 0
      });

      user.totalPoints -= pointsToWithdraw;
      await user.save();

      return res.json({ message: appString.WITHDRAWREQUEST, data: withdraw });
    } catch (error) {
      console.error("Withdrawal Error:", error);
      res.status(500).json({ error: appString.SERVERERROR });
    }
  }



};








module.exports = userController;
