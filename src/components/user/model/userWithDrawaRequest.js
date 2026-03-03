const mongoose = require("mongoose");
const userWithDrawRequestSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  membership_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "userMembership", 
    required: true 
  },
  pointRequestForWithdraw: { 
    type: Number, 
    required: true 
  },
  totalAmount: { 
    type: Number, 
    required: true 
  },
  processingFee: { 
    type: Number 
  },
  rewardableAmount: { 
    type: Number 
  },
  priority: { 
    type: Number // 1 for silver, 2 for gold, 3 for platinum 
  },
  status: { 
    type: Number, // 0 for pending, 1 for approved, 2 for rejected 
    default: 0
  }
});

module.exports = mongoose.model("WithDrawRequest", userWithDrawRequestSchema);
