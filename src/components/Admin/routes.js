const express = require("express");
const router = express.Router();

const adminController = require("./controller/adminController");
const categoryController = require("./controller/categoryController ");
const productController = require("./controller/productController"); 
const orderListController = require('../Admin/controller/orderListController');
const promoCodeController = require("./controller/promocodeController"); 
const { registerValidation } = require("./validation");
const { loginValidation } = require("../user/validation");
const { routeArray } = require("../../middleware");
const adminSettingController = require("./controller/adminSettingController");
const membershipController = require("./controller/subscriptionController")
const routes = [
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

  {
    path: "/category",
    method: "post",
    controller: categoryController.addCategory,
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

  {
    path: "/product",
    method: "post",
    controller: productController.addProduct, 
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
  {
    path: "/order-list",
    method: "get",
    controller: orderListController.getOrders, 
  },
  {
    path:"/update-payment",
    method:"put",
    controller: adminSettingController.updatePaymentMethod,
  },

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
  path:"/enable/:id",
  method:"patch",
  controller:promoCodeController.enablePromoCode
},
{
  path:"/addPlan",
  method:"post",
  controller:membershipController.addMembershipPlan
},
{
  path:"/updatesub/:id",
  method:"put",
  controller:membershipController.updateMembershipPlan
},
{
   path:"/disablesub/:id",
  method:"delete",
  controller:membershipController.disableSubscriptionPlan
},
{
   path:"/enablesub/:id",
  method:"post",
  controller:membershipController.reactivateSubscriptionplan
},
 {
        path:"/membership-status",
        method:"get",
        controller:adminController.getMembershipStatus
    }
];

module.exports = routeArray(routes, router, true);
