const AdminSetting = require("../model/adminSetting");
const { appString } = require("../../utils/appString");
const { success } = require("../../utils/commonUtils");

const adminSettingController ={
updatePaymentMethod :async (req, res) => {
  try {
    const { paymentMethod } = req.body;

    if (![1, 2, 3].includes(Number(paymentMethod))) {
      return console.error(400).json({ message: appString.INVALIDPAYMENTMETHOD });
    }

    const settings = await AdminSetting.findOneAndUpdate(
      {}, 
      { paymentMethod }, 
      { 
        new: 1,    
        upsert: 1, 
        runValidators: 1 
      }
    );

   return success(200).json({
      message: appString.PAYMENTMETHODUPDATED,
      data: settings,
    });
  } catch (error) {
    return console.error(500).json({ message: appString.SERVERERROR, error: error.message });
  }
}
};
module.exports = adminSettingController;
