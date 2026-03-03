const mongoose = require('mongoose');

const PromoCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    type: { type: Number, enum: [0, 1], required: true }, // 0: Auto, 1: Manual
    discountType: { type: String, enum: ['flat', 'percentage'], required: true },
    discountValue: { type: Number, required: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: { type: Number, enum: [0, 1], default: 1 }, // 1: Active, 0: Soft Deleted/Inactive
}, { timestamps: true });

    PromoCodeSchema.pre('save', async function () {
        if (this.type === 'automatic' && (!this.startDate || !this.endDate)) {
            throw new Error('Automatic promo codes must have start and end dates.');
        }
    });
    module.exports = mongoose.model('PromoCode', PromoCodeSchema);
