const AdminSetting = require("../model/adminSetting");
const { appString } = require("../../utils/appString");
const { success } = require("../../utils/commonUtils");

const adminSettingController = {
  updatePaymentMethod: async (req, res) => {
    try {
      const { paymentMethod } = req.body;

      // Use res.status() instead of console.error()
      if (![1, 2].includes(Number(paymentMethod))) {
        return res.status(400).json({ message: appString.INVALIDPAYMENTMETHOD });
      }

      const settings = await AdminSetting.findOneAndUpdate(
        {}, 
        { paymentMethod }, 
        { 
          new: true,    
          upsert: true, 
          runValidators: true 
        }
      );

      // Assuming your success helper works similarly to res.status
      // If "success" is a custom helper, ensure it's used correctly.
      // Usually, it is: res.status(200).json(success(data, message));
      return res.status(200).json({
        message: appString.PAYMENTMETHODUPDATED,
        data: settings,
      });

    } catch (error) {
      // FIX HERE: Use res.status(500)
      console.error("Update Payment Error:", error); // Log the error for debugging
      return res.status(500).json({ 
        message: appString.SERVERERROR, 
        error: error.message 
      });
    }
  }
};

module.exports = adminSettingController;
