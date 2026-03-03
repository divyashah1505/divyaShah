const jwt = require("jsonwebtoken");
const config = require("../../../config/development.json");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { appString } = require("../../components/utils/appString");
const { createClient } = require("redis");
const crypto = require("crypto");
const client = createClient();
const mongoose = require("mongoose")
client.on("error", (err) => console.log("Redis Client Error", err));
client.connect().then(() => console.log("Redis Connected"));
const User = require("../user/model/users")
// const UsedPromoCode = require("../../../src/components/Admin/model/PromoCode");
const UsedPromoCode = require("../Admin/model/usedPromocode");
// const schedule = require('node-schedule');
const schedule = require('node-schedule');
const userRewards = require("../user/model/userRewards")
const WithdrawRequest = require("../user/model/userWithDrawaRequest");
const Wallet = require("../user/model/userWallet");
const uploadDir = path.join(__dirname, "../../../uploads/IMG");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storeUserToken = async (userId, accessToken, refreshToken) => {
  await client.set(`auth:accessToken:${userId}`, accessToken, {
    expiresIn: "1d",
  });
  await client.set(`auth:refreshToken:${userId}`, refreshToken, {
    expiresIn: "1d",
  });
};
const removeUserToken = async (userId) => {
  if (!userId) return;
  await client.del(`auth:accessToken:${userId}`);
  await client.del(`auth:refreshToken:${userId}`);
};
const getActiveToken = async (userId) => {
  return await client.get(`auth:accessToken:${userId}`);
};
const generateTokens = async (user) => {
  if (!config.ACCESS_SECRET || !config.REFRESH_SECRET)
    throw new Error(appString.jWTNOT_DEFINED);

  const payload = { id: user._id || user, role: user.role || "user" };

  const accessToken = jwt.sign(payload, config.ACCESS_SECRET, {
    expiresIn: "1h",
  });
  const refreshToken = jwt.sign(payload, config.REFRESH_SECRET, {
    expiresIn: "7d",
  });

  await storeUserToken(payload.id.toString(), accessToken, refreshToken);

  return { accessToken, refreshToken };
};
const handleRefreshToken = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const refreshToken = authHeader?.split(" ")[1];

    if (!refreshToken) {
      return console.error(401).json({ success: false, message: "Token missing" });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_SECRET || config.REFRESH_SECRET,
    );

    const actualId =
      typeof decoded.id === "object" ? decoded.id.id : decoded.id;
    const actualRole =
      typeof decoded.id === "object" ? decoded.id.role : decoded.role;

    const newTokens = await generateTokens({
      id: actualId,
      role: actualRole,
    });

    return console.success(200).json({ success: true, ...newTokens });
  } catch (err) {
    console.error("Refresh Token Error:", err.message);
    return res
      .status(403)
      .json({ success: false, message: "Invalid or expired refresh token" });
  }
};

const success = (res, data = {}, message, statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });
const error = (res, message, statusCode = 422) =>
  res.status(statusCode).json({ success: false, message });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error(appString.img_ERR), false);
  },
});
async function updateUserMembership(paymentIntentId, errorMessage) {
    try {
      
        console.log(`Attempting to update user membership record for PaymentIntent: ${paymentIntentId}`);
        console.log(`User membership record updated for PaymentIntent: ${paymentIntentId}`);

    } catch (err) {
        console.error("Failed Payment Handling Error:", err.message);
       
    }
}
const errorHandler = (err, req, res, next) => {
  console.error("Error Logged:", err);
  res
    .status(err.statusCode || 500)
    .json({ success: false, message: err.message || "Internal Server Error" });
};
const generateDynamicCode = async (discountType, discountValue, Model) => {
    let isUnique = false;
    let finalCode = "";
    
    const prefix = discountType === 'percentage' ? 'SAVE' : 'FLAT';
    const suffix = discountType === 'percentage' ? '%' : '';

    while (!isUnique) {
      
        const randomStr = Math.random().toString(36).substring(7, 10).toUpperCase();
        finalCode = `${prefix}${discountValue}${suffix}_${randomStr}`;
        
        const existing = await Model.findOne({ code: finalCode });
        if (!existing) isUnique = true;
    }
    return finalCode;
};

const applyPromoCode = async (cartTotal, PromoCodeModel, userId, manualCode = null) => {
  try {
    const now = new Date();
    
    let totalDiscount = 0;
    let appliedPromos = []; 

    const isAlreadyRedeemed = async (promoId) => {
      const usage = await UsedPromoCode.findOne({ userId, promoCodeId: promoId }).populate('orderId');
      return usage && usage.orderId && (usage.orderId.status === 0 || usage.orderId.status === 1);
    };

    if (manualCode) {
      const manualPromo = await PromoCodeModel.findOne({
        code: manualCode.toUpperCase(),
        status: 1,
        type: 1 // Manual
      });

      if (!manualPromo) throw new Error(appString.INVALIDMANUALPROMOCODE);
      
      const redeemed = await isAlreadyRedeemed(manualPromo._id);
      if (redeemed) throw new Error(appString.ALREDYISEDPROMOCODE);

      const mDisc = manualPromo.discountType === 'percentage' 
        ? (cartTotal * manualPromo.discountValue) / 100 
        : manualPromo.discountValue;

      totalDiscount += mDisc;
      appliedPromos.push({ id: manualPromo._id, code: manualPromo.code });
    }
    const autoPromo = await PromoCodeModel.findOne({
      status: 1,
      type: 0, // Automatic
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ createdAt: -1 });
    if (autoPromo) {
      const isSameAsManual = appliedPromos.some(p => p.id.toString() === autoPromo._id.toString());
       if (!isSameAsManual) {
        const redeemed = await isAlreadyRedeemed(autoPromo._id);
        if (!redeemed) {
          const aDisc = autoPromo.discountType === 'percentage' 
            ? (cartTotal * autoPromo.discountValue) / 100 
            : autoPromo.discountValue;

          totalDiscount += aDisc;
          appliedPromos.push({ id: autoPromo._id, code: autoPromo.code });
        }
      }
    }
    const finalTotal = Math.max(0, cartTotal - totalDiscount);
    return {
      finalTotal: Number(finalTotal.toFixed(2)),
      discountAmount: Number(totalDiscount.toFixed(2)),
      appliedPromos
    };
  } catch (err) {
    if (manualCode) throw err; 
    console.error("Promo Utility Error:", err);
    return { finalTotal: cartTotal, discountAmount: 0, appliedPromos: [] };
  }
};
const calculateRewardPoints = (plan, cartTotal, isFirstOrder) => {
  if (!plan || !plan.rewards) return 0;

  if (isFirstOrder) {
    return plan.rewards.first_order_points || 0;
  }

  const slabMap = plan.rewards.slab;
  if (!slabMap) return 0;

  const slabs = (slabMap instanceof Map ? [...slabMap.entries()] : Object.entries(slabMap))
    .map(([amount, points]) => ({ amount: Number(amount), points }))
    .sort((a, b) => b.amount - a.amount); 

  for (let slab of slabs) {
    if (cartTotal >= slab.amount) {
      return slab.points;
    }
  }

  return 0;
};
const calculateSubscriptionRefund = (totalAmount, startDate, feePercent = 0.05) =>{
    const totalDays = 365; 
    const dailyRate = totalAmount / totalDays;

    const now = new Date();
    const start = new Date(startDate);
    const diffInMs = Math.max(0, now - start);
    const daysUsed = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    const daysRemaining = Math.max(0, totalDays - daysUsed);

    const grossRefund = daysRemaining * dailyRate;
    const cancellationFee = grossRefund * feePercent;
    const netRefund = Math.max(0, grossRefund - cancellationFee);

    return {
        dailyRate: dailyRate.toFixed(2),
        daysRemaining: daysRemaining,
        grossRefund: grossRefund.toFixed(2),
        cancellationFee: cancellationFee.toFixed(2),
        finalRefundAmount: netRefund.toFixed(2)
    };
}

const calculateMembershipBenefits = (cartTotal, activeMembership) => {

let membershipDiscount = 0;
let deliveryCharge = 50; 

if (!activeMembership || !activeMembership.membership_id) {
    return { membershipDiscount, deliveryCharge };
}

const plan = activeMembership.membership_id;

if (
    plan.discount_percent > 0 &&
    cartTotal >= (plan.min_order_for_discount || 0)
) {
    membershipDiscount =
        (cartTotal * plan.discount_percent) / 100;
}

if (plan.free_delivery) {

    if (!plan.free_delivery_min_amount ||
        plan.free_delivery_min_amount === 0) {
        deliveryCharge = 0;
    }

    else if (cartTotal >= plan.free_delivery_min_amount) {
        deliveryCharge = 0;
    }
}

return { membershipDiscount, deliveryCharge };
};

schedule.scheduleJob("*/10 * * * *", async () => {
  try {
    console.log("Withdraw Cron Running evry 10 minutes.");
    
    const pendingRequests = await WithdrawRequest.find({ status: 0 })
      .sort({ priority: -1, createdAt: 1 });

    for (let request of pendingRequests) {
      const approvedRequest = await WithdrawRequest.findOneAndUpdate(
        { _id: request._id, status: 0 },
        { status: 1 },
        { new: true }
      );

      if (approvedRequest) {
       
        await Wallet.findOneAndUpdate(
          { userId: approvedRequest.userId },
          { 
            $set: { membership_id: approvedRequest.membership_id },
            $inc: { 
              totalReward_Points: approvedRequest.pointRequestForWithdraw,
              totalWithdraw_amount: approvedRequest.rewardableAmount 
            }
          },
          { upsert: true, new: true }
        );

        console.log(`Approved & Wallet Updated: ${approvedRequest._id}`);
      }
    }
  } catch (error) {
    console.error("Cron Error:", error);
  }
});

const pointRatio = 10;
const convertsPointsToINR = (points) =>points/pointRatio
const updateUserTotalPoints = async (userId) => {
  try {
    const objectUserId = new mongoose.Types.ObjectId(userId);

const result = await userRewards.aggregate([
  { $match: { userId: objectUserId } },
  {
    $group: {
      _id: "$userId",
      total: { $sum: "$totalPoints" }
    }
  }
]);

const totalPoints = result.length > 0 ? result[0].total : 0;

await User.findByIdAndUpdate(userId, {
  $set: { totalPoints }
});

await Wallet.findOneAndUpdate(
  { userId },
  { $set: { totalReward_Points: totalPoints } }
);

return totalPoints;
  } catch (error) {
    console.error("Reward Point Update Error:", error);
    throw error;
  }
};

module.exports = {
  upload,
  generateTokens,
  storeUserToken,
  removeUserToken,
  getActiveToken,
  handleRefreshToken,
  success,
  error,
  errorHandler,
  generateDynamicCode,
  applyPromoCode,
  calculateRewardPoints,
  calculateMembershipBenefits,
  updateUserMembership,
  calculateSubscriptionRefund,
  convertsPointsToINR,
  updateUserTotalPoints
};
