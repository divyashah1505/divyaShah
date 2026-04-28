// src\middleware\index.js
const jwt = require("jsonwebtoken");
const config = require("../../config/development");
const { appString } = require("../components/utils/appString");
const Validator = require("validatorjs");
const admin = require("../components/Admin/model/admin");
const user = require("../components/user/model/users");
const { getActiveToken } = require("../components/utils/commonUtils");

// --- Multer Configuration ---
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/IMG";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const multerInstance = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images are allowed (jpeg, jpg, png, webp, gif)"));
  },
});

/**
 * We export 'upload' as the result of .any(). 
 * This makes 'upload' a FUNCTION that can be called as upload(req, res, cb)
 */
const upload = multerInstance.any();

// --- Existing Functions ---

const verifyToken = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ message: appString.AUTHORIZATIONHEADERS });
    }

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, config.ACCESS_SECRET);

    // --- REDIS TOKEN CHECK (commented out — Redis unavailable on deployment) ---
    // When Redis is available, this validates the token is still active (not logged out).
    // Without Redis, we rely solely on JWT signature + expiry verification above.
    // To re-enable: uncomment the block below and ensure REDIS_URL is set on Render.
    //
    // const savedToken = await getActiveToken(decoded.id);
    // if (!savedToken || savedToken !== token) {
    //   return res.status(401).json({ message: appString.SESSIONEXPIRED });
    // }
    // --- END REDIS TOKEN CHECK ---

    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    const msg = err.name === "TokenExpiredError" ? "Token Expired" : "Invalid Token";
    return res.status(401).json({ message: msg });
  }
};

const checkRole = (isAdminRoute) => async (req, res, next) => {
  try {
    const userPayload = req.user;
    if (!userPayload) {
      return res.status(401).json({ message: appString.Unauthorized });
    }

    const userId = typeof userPayload.id === "object" ? userPayload.id.id : userPayload.id;

    if (!userId) {
      return res.status(400).json({ message: "User identity not found in token" });
    }

    if (isAdminRoute) {
      const adminData = await admin.findById(userId);
      if (adminData) return next();
      return res.status(403).json({ message: appString.Forbidden });
    } else {
      const userData = await user.findById(userId);
      if (userData) return next();
      return res.status(403).json({ message: appString.Forbidden1 });
    }
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const isAuthenticated = (req, res, next) => {
  if (!req.cookies || !req.cookies.accessToken) {
    return res.status(401).json({
      success: false,
      message: appString.LOGIN_FIRST,
    });
  }
  next();
};

const routeArray = (array_, prefix, isAdmin = false) => {
  array_.forEach((route) => {
    const { method, path, controller, validation, middleware, isPublic = false } = route;
    let middlewares = [];

    if (!isPublic) {
      middlewares.push(verifyToken);
      middlewares.push(checkRole(isAdmin));
    }

    if (middleware) middlewares.push(...(Array.isArray(middleware) ? middleware : [middleware]));
    if (validation) middlewares.push(...(Array.isArray(validation) ? validation : [validation]));

    const validStack = [...middlewares, controller].filter((h) => typeof h === "function");

    prefix[method.toLowerCase()](<path, ...validStack>);
  });
  return prefix;
};

const validatorUtilWithCallback = (rules, customMessages, req, res, next) => {
  Validator.useLang(req?.headers?.lang ?? "en");
  const validation = new Validator(req.body, rules, customMessages);
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
  isAuthenticated,
  routeArray,
  validatorUtilWithCallback,
  checkRole,
  upload, 
};
