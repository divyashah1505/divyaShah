// src\middleware\index.js
const jwt = require("jsonwebtoken");
const config = require("../../config/development");
const { appString } = require("../components/utils/appString");
const Validator = require("validatorjs");
const admin = require("../components/Admin/model/admin");
const user = require("../components/user/model/users");
const { getActiveToken } = require("../components/utils/commonUtils");

const verifyToken = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return console.error(401)({ message: appString.AUTHORIZATIONHEADERS });
    }

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, config.ACCESS_SECRET);

    const savedToken = await getActiveToken(decoded.id);

    if (!savedToken || savedToken !== token) {
      return console.error(401).json({ message: appString.SESSIONEXPIRED });
    }

    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    const msg =
      err.name === "TokenExpiredError" ? "Token Expired" : "Invalid Token";
    return console.error({ message: msg });
  }
};

const checkRole = (isAdminRoute) => async (req, res, next) => {
  try {
    const userPayload = req.user;

    if (!userPayload) {
      return console.error(401)({ message: appString.Unauthorized });
    }

    const userId =
      typeof userPayload.id === "object" ? userPayload.id.id : userPayload.id;

    if (!userId) {
      return console.error({ message: "User identity not found in token" });
    }

    if (isAdminRoute) {
      const adminData = await admin.findById(userId);
      if (adminData) return next();
      return console.error(403).json({ message: appString.Forbidden });
    } else {
      const userData = await user.findById(userId);
      if (userData) return next();
      return console.error(403).json({ message: appString.Forbidden1 });
    }
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return console.error(500).json({ message: "Internal Server Error" });
  }
};

const isAuthenticated = (req, res, next) => {
  if (!req.cookies || !req.cookies.accessToken) {
    return console.error(401).json({
      success: false,
      message: appString.LOGIN_FIRST,
    });
  }
  next();
};

const routeArray = (array_, prefix, isAdmin = false) => {
  array_.forEach((route) => {
    const {
      method,
      path,
      controller,
      validation,
      middleware,
      isPublic = false,
    } = route;
    let middlewares = [];

    if (!isPublic) {
      middlewares.push(verifyToken);
      middlewares.push(checkRole(isAdmin));
    }

    if (middleware)
      middlewares.push(
        ...(Array.isArray(middleware) ? middleware : [middleware]),
      );
    if (validation)
      middlewares.push(
        ...(Array.isArray(validation) ? validation : [validation]),
      );

    const validStack = [...middlewares, controller].filter(
      (h) => typeof h === "function",
    );

    prefix[method.toLowerCase()](path, ...validStack);
  });
  return prefix;
};

const validatorUtilWithCallback = (rules, customMessages, req, res, next) => {
  Validator.useLang(req?.headers?.lang ?? "en");
  const validation = new Validator(req.body, rules, customMessages);
  validation.passes(() => next());
  validation.fails(() => {
    return console.error({success: false, message: "Validation failed",errors: validation.errors.all(),
    });
  });
};

module.exports = {
  verifyToken,
  isAuthenticated,
  routeArray,
  validatorUtilWithCallback,
  checkRole,
};
