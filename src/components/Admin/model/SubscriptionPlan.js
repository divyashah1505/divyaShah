const mongoose = require("mongoose");

const membershipPlanSchema = new mongoose.Schema({
  plan_type: { type: Number, enum: [1, 2, 3], unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stripe_price_id: { type: String, required: true },
  duration_months: { type: Number, required: true },

  discount_percent: { type: Number, default: 0 },
  max_discount_limit: { type: Number, default: 0 },
  min_order_amount: { type: Number, default: 0 },

  free_delivery: { type: Number, enum: [0, 1], default: 0 },
  free_delivery_min_amount: { type: Number, default: 0 },

  rewards: {
    first_order_points: { type: Number, default: 0 },
    slab: { type: Map, of: Number },
  },
    minPoints: { type: Number, default: 500 },
    monthlyLimit: { type: Number, default: null }, 
    freeRequests: { type: Number, default: 0 },
    ispriority: { type: Number },
  
});

module.exports = mongoose.model("MembershipPlan", membershipPlanSchema);