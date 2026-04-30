const express = require("express");
const router = express.Router();

// Controllers
const adminController = require("./controller/adminController");
const categoryController = require("./controller/categoryController "); // ✅ fixed (removed space)
const productController = require("./controller/productController");
const orderListController = require("./controller/orderListController");
const promoCodeController = require("./controller/promocodeController");
const adminSettingController = require("./controller/adminSettingController");
const membershipController = require("./controller/subscriptionController");

// Validations
const { registerValidation } = require("./validation");
const { loginValidation } = require("../user/validation");

// ✅ Import centralized middleware (IMPORTANT)
const { routeArray, upload } = require("../../middleware");

// ================= ROUTES =================
const routes = [
  // ================= ADMIN AUTH =================
  {
    path: "/registeradmin",
    method: "post",
    controller: adminController.register,
    validation: registerValidation,
    isPublic: true,
  },
  {
    path: "/loginAdmin",
    method: "post",
    controller: adminController.login,
    validation: loginValidation,
    isPublic: true,
  },
  {
    path: "/verify-2fa",
    method: "post",
    controller: adminController.verifyAdmin2FA,
    isPublic: true,
  },

  // ================= 2FA =================
  {
    path: "/2fa/setup",
    method: "post",
    controller: adminController.setup2FA,
  },
  {
    path: "/2fa/enable",
    method: "post",
    controller: adminController.enable2FA,
  },

  // ================= USERS =================
  {
    path: "/user-list",
    method: "get",
    controller: adminController.userList,
  },
  {
    path: "/user/status",
    method: "put",
    controller: adminController.updateUserStatus,
  },
  {
    path: "/user/activate/:userId",
    method: "put",
    controller: adminController.activateUser,
  },
  {
    path: "/user/:userId",
    method: "delete",
    controller: adminController.deleteUser,
  },

  // ================= CATEGORY =================
  {
    path: "/category",
    method: "post",
    controller: categoryController.addCategory,
    middleware: [upload.single("image")], // ✅ centralized multer
  },
  {
    path: "/list-categoriesdetails",
    method: "get",
    controller: categoryController.listCategories,
  },
  {
    path: "/category/:id",
    method: "put",
    controller: categoryController.updateCategory,
    middleware: [upload.single("image")],
  },
  {
    path: "/category/:id",
    method: "delete",
    controller: categoryController.deleteCategory,
  },
  {
    path: "/category/reactivate/:id",
    method: "put",
    controller: categoryController.reactivateCategory,
  },

  // ================= PRODUCT =================
  {
    path: "/product",
    method: "post",
    controller: productController.addProduct,
    middleware: [upload.single("image")], // ✅ important
  },
  {
    path: "/product-list",
    method: "get",
    controller: productController.listProducts,
  },
  {
    path: "/product/:id",
    method: "put",
    controller: productController.updateProduct,
    middleware: [upload.single("image")], // ✅ important
  },
  {
    path: "/product/:id",
    method: "delete",
    controller: productController.deleteProduct,
  },
  {
    path: "/product/reactivate/:id",
    method: "put",
    controller: productController.reactivateProduct,
  },

  // ================= ORDERS =================
  {
    path: "/order-list",
    method: "get",
    controller: orderListController.getOrders,
  },

  // ================= SETTINGS =================
  {
    path: "/update-payment",
    method: "put",
    controller: adminSettingController.updatePaymentMethod,
  },

  // ================= PROMOCODE =================
  {
    path: "/promocode",
    method: "post",
    controller: promoCodeController.addPromoCode,
  },
  {
    path: "/list-promocodes",
    method: "get",
    controller: promoCodeController.listPromoCodes,
  },
  {
    path: "/promocode/:id",
    method: "put",
    controller: promoCodeController.updatePromoCode,
  },
  {
    path: "/promocode/:id",
    method: "delete",
    controller: promoCodeController.deletePromoCode,
  },
  {
    path: "/enable/:id",
    method: "patch",
    controller: promoCodeController.enablePromoCode,
  },

  // ================= MEMBERSHIP =================
  {
    path: "/view-subscription-plans",
    method: "get",
    controller: membershipController.getAllMembershipPlans,
  },
  {
    path: "/view-subscription-plans/:id",
    method: "get",
    controller: membershipController.getMembershipPlanById,
  },
  {
    path: "/addPlan",
    method: "post",
    controller: membershipController.addMembershipPlan,
  },
  {
    path: "/updatesub/:id",
    method: "put",
    controller: membershipController.updateMembershipPlan,
  },
  {
    path: "/disablesub/:id",
    method: "delete",
    controller: membershipController.disableSubscriptionPlan,
  },
  {
    path: "/enablesub/:id",
    method: "post",
    controller: membershipController.reactivateSubscriptionplan,
  },
  {
    path: "/membership-status",
    method: "get",
    controller: adminController.getMembershipStatus,
  },

  // ================= PHOTO UPLOAD (OPTIONAL) =================
  {
    path: "/upload-photos",
    method: "post",
    controller: adminController.uploadPhotos,
    middleware: [upload.single("image")],
  },
];

// Apply dynamic routing
module.exports = routeArray(routes, router, true);