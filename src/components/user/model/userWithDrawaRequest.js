const mongoose = require("mongoose");

const userWithDrawRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    membership_id: { type: mongoose.Schema.Types.ObjectId, ref: "userMembership", required: true },
    pointRequestForWithdraw: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    processingFee: { type: Number },
    rewardableAmount: { type: Number },
    priority: { 
        type: Number, // 1: Silver, 2: Gold, 3: Platinum
        default: 1 
    },
    status: { 
        type: Number, // 0: Pending, 1: Approved, 2: Rejected
        default: 0,
        index: true
    }
}, { timestamps: true });

userWithDrawRequestSchema.index({ status: 1, priority: -1, createdAt: 1 });

module.exports = mongoose.model("WithDrawRequest", userWithDrawRequestSchema);
