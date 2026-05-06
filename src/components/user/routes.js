const UserController = require("./controller/userController");
const { upload } = require("../utils/commonUtils");
const Category = require("../../components/Admin/model/category");
const {
    loginValidation,
    registerValidation,
    AddressValidation,
    addCartvalidation
} = require("./validation");
const { handleRefreshToken } = require("../../components/utils/commonUtils");
const cartController = require("./controller/cartController");
const orderController = require("./controller/orderController");
const userController = require("./controller/userController");

module.exports = [
    {
        path: "/register",
        method: "post",
        controller: UserController.register,
        validation: registerValidation,
        isPublic: true,
    },
    {
        path: "/verify-otp",
        method: "post",
        controller: UserController.verifyOtp,
        isPublic: true,
    },
    {
        path: "/resend-otp",
        method: "post",
        controller: UserController.resendOtp,
        isPublic: true,
    },
    {
        path: "/getActiveCategories",
        method: "get",
        controller: UserController.getActiveCategories,
        isPublic: true,
    },
    {
        path: "/login",
        method: "post",
        controller: UserController.login,
        validation: loginValidation,
        isPublic: true,
    },
    {
        path: "/mySubscription",
        method: "get",
        controller: UserController.mySubscription,
    },
    {
        path: "/profileupload",
        method: "post",
        middleware: [upload.array("file")],
        controller: UserController.profileUpload,
        isPublic: true,
    },
    {
        path: "/products/:categoryId",
        method: "get",
        controller: UserController.getProductsBySubCategory,
    },
    {
        path: "/profile",
        method: "get",
        controller: UserController.getProfile,
    },
    {
        path: "/update",
        method: "put",
        controller: UserController.updateUser,
    },
    {
        path: "/delete",
        method: "delete",
        controller: UserController.deleteUser,
    },
    {
        path: "/logout",
        method: "post",
        controller: UserController.logout,
    },
    {
        path: "/refresh-token",
        method: "post",
        controller: handleRefreshToken,
        isPublic: true,
    },
    {
        path: "/change-password",
        method: "put",
        controller: UserController.changePassword,
    },
    {
        path: "/add",
        method: "post",
        controller: UserController.insertAddress,
        validation: AddressValidation,
    },
    {
        path: "/listalladdress",
        method: "get",
        controller: UserController.listUserAddresses,
    },
    {
        path: "/chnageprimadd",
        method: "put",
        controller: UserController.changePrimaryAddress,
    },
    {
        path: "/forgot-password",
        method: "post",
        controller: UserController.forgotPassword,
        isPublic: true,
    },
    {
        path: "/reset-password",
        method: "post",
        controller: UserController.resetPassword,
        isPublic: true,
    },
    {
        path: "/verify-otp-reset",
        method: "post",
        controller: UserController.verifyResetOtp,
        isPublic: true,
    },
    {
        path: "/add-to-cart",
        method: "post",
        validation: addCartvalidation,
        controller: cartController.addToCart,
    },
    {
        path: "/view-cart",
        method: "get",
        controller: cartController.getCart,
    },

    {
        path: "/initialize-order",
        method: "post",
        controller: orderController.createOrderFromCart
    },
    {
        path: "/order-history",
        method: "get",
        controller: orderController.getOrderHistory
    },
    {
        path: "/madePayment",
        method: "post",
        controller: userController.madePayment
    },
    {
        path: "/paymentInitate",
        method: "post",
        controller: userController.initiatesSubscription
    },
    {
        path: "/verifySubscription",
        method: "get",
        controller: userController.verifySubscription
    },
    {
        path: "/cancelsubscription",
        method: "delete",
        controller: userController.cancelMembership
    },
    {
        path: "/withDrawByUser",
        method: "post",
        controller: userController.createwithdrawalrequest
    },

    {
        path: "/getSubscriptionDetails",
        method: "get",
        controller: userController.getSubscriptionPlans,
        isPublic: true,
    },
    {
        path: "/get-wallet",
        method: "get",
        controller: userController.getWallet,
    },


];

