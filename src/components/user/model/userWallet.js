const mongoose = require("mongoose")
const UserWalletSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    membership_id: { type: mongoose.Schema.Types.ObjectId, ref: "userMembership" }, // optional — not required for refund credits
    totalReward_Points: {
        type: Number,
        default: 0
    },
    totalWithdraw_amount: {
        type: Number,
        default: 0
    },
})
module.exports = mongoose.model("Wallet", UserWalletSchema);