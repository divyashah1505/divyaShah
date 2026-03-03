const mongoose = require("mongoose");

const userMembershipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    membership_id: { type: mongoose.Schema.Types.ObjectId, ref: "MembershipPlan", required: true },
    stripe_price_id: String,
    stripe_subscription_id: String,
    stripecustomer_Id: String,
    last_charge_id: { type: String }, // Specifically for the ch_... ID
    status: { type: Number, enum: [0, 1, 2], default: 0 }, 
    paymentstatus: { type: Number, enum: [0, 1, 2], default: 0 }, 
    refunded: { type: Number, default: 0 },
    membershipDetails: Object,
    is_first_order_after_membership: { type: Number, default: 0 },
    startDate: Date,
    endDate: Date,
    sessionId:{
      type:String
    },
    order_reference:{
      type:String
    },
    paymentIntentId:{
      type:String
    },
 last_refund_id: { type: String }, 
  actual_refunded_amount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("userMembership", userMembershipSchema);
