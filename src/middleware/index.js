// src/middleware/index.js
const jwt = require("jsonwebtoken");
const config = require("../../config/development");
const { appString } = require("../components/utils/appString");
const Validator = require("validatorjs");
const admin = require("../components/Admin/model/admin");
const user = require("../components/user/model/users");

// ==============================
// Multer + Cloudinary Upload Setup
// ==============================
const multer = require("multer");

const storage = multer.memoryStorage();

const multerInstance = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;

    const isMimeValid = allowedTypes.test(file.mimetype);
    const extension = file.originalname
      .split(".")
      .pop()
      .toLowerCase();

    const isExtValid = allowedTypes.test(extension);

    if (isMimeValid && isExtValid) {
      return cb(null, true);
    }

    cb(
      new Error(
        "Only image files are allowed (jpeg, jpg, png, webp, gif)"
      )
    );
  },
});

/**
 * Upload middleware
 * Usage: upload(req, res, callback)
 */
const upload = multerInstance;
// ==============================
// JWT Verification
// ==============================
const verifyToken = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: appString.AUTHORIZATIONHEADERS,
      });
    }

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, config.ACCESS_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError"
        ? "Token Expired"
        : "Invalid Token";

    return res.status(401).json({
      success: false,
      message,
    });
  }
};

// ==============================
// Role Checking
// ==============================
const checkRole = (isAdminRoute) => {
  return async (req, res, next) => {
    try {
      const userPayload = req.user;

      if (!userPayload) {
        return res.status(401).json({
          success: false,
          message: appString.Unauthorized,
        });
      }

      const userId =
        typeof userPayload.id === "object"
          ? userPayload.id.id
          : userPayload.id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User identity not found in token",
        });
      }

      if (isAdminRoute) {
        const adminData = await admin.findById(userId);

        if (!adminData) {
          return res.status(403).json({
            success: false,
            message: appString.Forbidden,
          });
        }
      } else {
        const userData = await user.findById(userId);

        if (!userData) {
          return res.status(403).json({
            success: false,
            message: appString.Forbidden1,
          });
        }
      }

      next();
    } catch (err) {
      console.error("Authorization Error:", err);

      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  };
};

// ==============================
// Cookie Authentication
// ==============================
const isAuthenticated = (req, res, next) => {
  if (!req.cookies?.accessToken) {
    return res.status(401).json({
      success: false,
      message: appString.LOGIN_FIRST,
    });
  }

  next();
};

// ==============================
// Dynamic Route Loader
// ==============================
const routeArray = (routes, router, isAdmin = false) => {
  routes.forEach((route) => {
    const {
      method,
      path,
      controller,
      validation,
      middleware,
      isPublic = false,
    } = route;

    const middlewares = [];

    if (!isPublic) {
      middlewares.push(verifyToken);
      middlewares.push(checkRole(isAdmin));
    }

    if (middleware) {
      middlewares.push(
        ...(Array.isArray(middleware)
          ? middleware
          : [middleware])
      );
    }

    if (validation) {
      middlewares.push(
        ...(Array.isArray(validation)
          ? validation
          : [validation])
      );
    }

    const validStack = [...middlewares, controller].filter(
      (fn) => typeof fn === "function"
    );

    router[method.toLowerCase()](path, ...validStack);
  });

  return router;
};

// ==============================
// Validator Helper
// ==============================
const validatorUtilWithCallback = (
  rules,
  customMessages,
  req,
  res,
  next
) => {
  Validator.useLang(req?.headers?.lang ?? "en");

  const validation = new Validator(
    req.body,
    rules,
    customMessages
  );

  validation.passes(() => next());

  validation.fails(() => {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.errors.all(),
    });
  });
};

module.exports = {
  verifyToken,
  checkRole,
  isAuthenticated,
  routeArray,
  validatorUtilWithCallback,
  upload,
};