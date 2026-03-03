const PromoCode = require("../model/PromoCode");
const { success, error, generateDynamicCode } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");

const promoCodeController = {
 addPromoCode: async (req, res) => {
  try {
    let { type, discountType, discountValue, startDate, endDate } = req.body;
    if(startDate || endDate){

  
    startDate = new Date(startDate);
    startDate.setHours(0, 0, 0, 0); 

    endDate = new Date(endDate);
    endDate.setHours(23, 59, 59, 999); 

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      return error(res, appString.DATEVALIDATION, 400);
    }

    if (endDate < startDate) {
      return error(res, appString.ENDDATE, 400);
    }
  }
    const code = await generateDynamicCode(discountType, discountValue, PromoCode);

    const promoCode = await PromoCode.create({
      code,
      type,
      discountType,
      discountValue,
      startDate, 
      endDate,     
      status: 1
    });

    return success(res, promoCode, appString.PROMOCODECREATED, 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
},

  listPromoCodes: async (req, res) => {
    try {
      const { search } = req.query;
      let query = { status: 1 };

      if (search) {
        query.code = new RegExp(search, "i");
      }

      const promoCodes = await PromoCode.find(query).sort({ createdAt: -1 });
      return success(res, promoCodes, appString.PROMOCODEFETCHED);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },

  deletePromoCode: async (req, res) => {
    try {
      const { id } = req.params;
      const promo = await PromoCode.findByIdAndUpdate(
        id,
        { $set: { status: 0 } },
        { new: 1 }
      );

      if (!promo) return error(res, appString.PROMOCODENOTFOUND, 404);
      return success(res, null, appString.PROMOCODEDELETED);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },

updatePromoCode: async (req, res) => {
    try {
        const { id } = req.params;
        const { type, discountType, discountValue, startDate, endDate, isActive } = req.body;

        let promo = await PromoCode.findOne({ _id: id, status: { $ne: 0 } });
        if (!promo) return error(res, appString.PROMOCODENOTFOUND, 404);

        if (discountType !== undefined && discountType !== promo.discountType) {
            return error(res, "Changing discount type (Flat/Percentage) is not allowed after creation", 400);
        }

        const finalStart = startDate ? new Date(startDate) : new Date(promo.startDate);
        const finalEnd = endDate ? new Date(endDate) : new Date(promo.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (startDate && new Date(startDate) < today) {
            return error(res, appString.DATEVALIDATION, 400);
        }

        if (finalEnd < finalStart) {
            return error(res, appString.ENDDATE, 400);
        }

        const finalType = type !== undefined ? type : promo.type;
        if (finalType === 0 && (!finalStart || !finalEnd)) {
            return error(res, appString.REQUIREDDATE, 400);
        }

        let newCode = promo.code;
        if (discountValue && discountValue !== promo.discountValue) {
            newCode = await generateDynamicCode(
                promo.discountType, 
                discountValue,
                PromoCode
            );
        }

        const updatedPromo = await PromoCode.findByIdAndUpdate(
            id,
            {
                $set: {
                    code: newCode,
                    type: finalType,
                    discountValue: discountValue || promo.discountValue,
                    startDate: finalStart,
                    endDate: finalEnd,
                    isActive: isActive !== undefined ? isActive : promo.isActive
                }
            },
            { new: true, runValidators: true }
        );

        return success(res, updatedPromo, appString.PROMOCODEUPDATED);
    } catch (err) {
        return error(res, err.message, 400);
    }
},


  enablePromoCode: async (req, res) => {
    try {
      const { id } = req.params;
      const promo = await PromoCode.findByIdAndUpdate(id, { $set: { status: 1 } }, { new: 1 });
      if (!promo) return error(res, appString.PROMOCODENOTFOUND, 404);
      return success(res, promo, appString.PROMOCODEENABLED);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
};

module.exports = promoCodeController;
