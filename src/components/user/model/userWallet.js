const mongoose = require("mongoose")
const UserWalletSchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    membership_id: { type: mongoose.Schema.Types.ObjectId, ref: "userMembership", required: true },
    totalReward_Points: {
        type: Number,
    },
    totalWithdraw_amount: {
        type: Number
    },
})
module.exports = mongoose.model("Wallet", UserWalletSchema);