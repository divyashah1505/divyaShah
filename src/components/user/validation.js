const val = require("../../middleware/index");
const order = require("./model/order");

async function registerValidation(req, res, next) {
  const validationRule = {
    username: "required|string|min:6|regex:/^(?=.*[a-z])(?=.*[A-Z]).+$/",
    // Email is required ONLY IF mobile is missing
    email: "required_without:mobile|string|email|min:4|max:255",
    // Mobile is required ONLY IF email is missing
    mobile: "required_without:email|numeric|digits_between:10,15",
    password:
      "required|min:8|max:50|regex:/[A-Z]/|regex:/[0-9]/|regex:/[@$!%*#?&]/",
  };
  
  const customMessages = {
    "required_without.email": "Either email or mobile number is required.",
    "required_without.mobile": "Either email or mobile number is required.",
  };

  val.validatorUtilWithCallback(validationRule, customMessages, req, res, next);
}


async function loginValidation(req, res, next) {
  const validationRule = {
    email: "required_without_all:username,mobile|string|email|min:4|max:255",
    
    username: "required_without_all:email,mobile|string|min:6",
    
    mobile: "required_without_all:email,username|numeric|digits_between:10,15",
    
    password: "required|string"
  };

  const customMessages = {
    "required_without_all": "Please provide an email, username, or mobile number to login.",
  };

  val.validatorUtilWithCallback(validationRule, customMessages, req, res, next);
}


async function AddressValidation(req, res, next) {
  const validationRule = {
    Address: "required|string|min:4|max:20",
    isPrimary: "required|numeric|in:0,1",
  };
  val.validatorUtilWithCallback(validationRule, {}, req, res, next);
}

async function addCartvalidation(req, res, next) {
  const validationRule = {
    product: "required|array",
    "product.*.productId": "required|string",
    "product.*.quantity": "required|numeric|min:0",
    "product.*.price": "required|numeric|min:0",    
  };

  val.validatorUtilWithCallback(validationRule, {}, req, res, next);
}

async function orderCartValidation(req,res,next){
    const validationRule = {
      order:"required",
    }
    val.validatorUtilWithCallback(validationRule,{},req,res,next);
}




module.exports = { 
  registerValidation, 
  loginValidation, 
  AddressValidation, 
  addCartvalidation ,
  orderCartValidation
};
