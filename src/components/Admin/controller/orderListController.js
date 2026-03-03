const Order = require("../../user/model/order");
const { success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");

const orderListController = {
    getOrders: async (req, res) => {
        try {
            const orders = await Order.find()
                .populate("userId", "name email") 
                .sort({ createdAt: -1 });

            return success(res, orders, appString.ORDERFETCHED);
            
        } catch (err) {
            return error(res, err.message || appString.SERVERERROR);
        }
    },
   
};

module.exports = orderListController;
