const Admin = require("../model/admin");
const User = require("../../user/model/users");
const { generateTokens, success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const config = require("../../../../config/development.js");
const category = require("../model/category");
const user = require("../../user/model/users")
// const userMembership = require("../../user/model/userMembership");
const UserMembership = require("../../user/model/userMembership");
const { upload } = require("../../../middleware");
const multer  = require("multer");
const adminController = {
  register: async (req, res) => {
    try {
      const { username, email, password } = req.body;
      const adminExists = await Admin.findOne({});

      if (adminExists) {
        return error(res, appString.ADMINALREDY_REGISTER, 409);
      }
      const newAdmin = await Admin.create({ username, email, password });
      const tokens = generateTokens(newAdmin._id);
      return success(
        res,
        { admin: newAdmin, ...tokens },
        appString.ADMIN_CREATED,
        201,
      );
    } catch (err) {
      if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return error(res, `${field} already exists`, 409);
      }
      return error(res, err.message || appString.REGISTRATION_FAILED, 400);
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const admin = await Admin.findOne({ email });
      if (!admin || !(await admin.matchPassword(password))) {
        return error(res, appString.INVALID_CREDENTIALS, 401);
      }

      if (Number(admin.is2FaEnabled) === 1) {
        const twoFaToken = jwt.sign(
          { id: admin._id, role: "admin", purpose: "admin-2fa" },
          config.ACCESS_SECRET,
          { expiresIn: "5m" },
        );

        return success(
          res,
          {
            requires2FA: true,
            twoFaToken,
            username: admin.username,
            email: admin.email,
          },
          "2FA verification required",
        );
      }

      const tokens = await generateTokens(admin);
      success(
        res,
        { username: admin.username, email: admin.email, ...tokens },
        appString.LOGIN_SUCCESS,
      );
    } catch (err) {
      error(res, err.message || appString.LOGIN_FAILED, 500);
    }
  },
  setup2FA: async (req, res) => {
    try {
      const adminId = req?.user?.id;
      if (!adminId) return error(res, appString.Unauthorized, 401);

      const admin = await Admin.findById(adminId);
      if (!admin) return error(res, appString.NOT_FOUND, 404);

      const secret = speakeasy.generateSecret({
        name: `CrudProject Admin (${admin.email})`,
        issuer: "CrudProject",
      });

      admin.twoFaSecret = secret.base32;
      admin.is2faverified = 0;
      await admin.save();

      return success(
        res,
        {
          requires2FA: true,
          manualEntryKey: secret.base32,
          otpauthUrl: secret.otpauth_url,
          is2FaEnabled: Number(admin.is2FaEnabled),
        },
        "2FA setup generated",
      );
    } catch (err) {
      return error(res, err.message || "2FA setup failed", 500);
    }
  },
  enable2FA: async (req, res) => {
    try {
      const adminId = req?.user?.id;
      const { otp } = req.body;

      if (!adminId) return error(res, appString.Unauthorized, 401);
      if (!otp) return error(res, "OTP is required", 400);

      const admin = await Admin.findById(adminId);
      if (!admin || !admin.twoFaSecret) {
        return error(res, "2FA is not initialized for this admin", 400);
      }

      const verified = speakeasy.totp.verify({
        secret: admin.twoFaSecret,
        encoding: "base32",
        token: String(otp),
        window: 1,
      });

      if (!verified) return error(res, "Invalid OTP", 401);

      admin.is2FaEnabled = 1;
      admin.is2faverified = 1;
      await admin.save();

      return success(res, { is2FaEnabled: 1 }, "2FA enabled successfully");
    } catch (err) {
      return error(res, err.message || "Enable 2FA failed", 500);
    }
  },
  verifyAdmin2FA: async (req, res) => {
    try {
      const { otp, twoFaToken } = req.body;
      if (!otp || !twoFaToken) {
        return error(res, "OTP and twoFaToken are required", 400);
      }

      let decoded;
      try {
        decoded = jwt.verify(twoFaToken, config.ACCESS_SECRET);
      } catch (tokenErr) {
        return error(res, "2FA session expired. Please login again", 401);
      }

      if (decoded?.purpose !== "admin-2fa") {
        return error(res, "Invalid 2FA token", 401);
      }

      const admin = await Admin.findById(decoded.id);
      if (!admin || Number(admin.is2FaEnabled) !== 1 || !admin.twoFaSecret) {
        return error(res, "2FA is not enabled for this admin", 400);
      }

      const verified = speakeasy.totp.verify({
        secret: admin.twoFaSecret,
        encoding: "base32",
        token: String(otp),
        window: 1,
      });

      if (!verified) return error(res, "Invalid OTP", 401);

      admin.is2faverified = 1;
      await admin.save();

      const tokens = await generateTokens(admin);
      return success(
        res,
        { username: admin.username, email: admin.email, ...tokens },
        appString.LOGIN_SUCCESS,
      );
    } catch (err) {
      return error(res, err.message || "2FA verification failed", 500);
    }
  },
  userList: async (req, res) => {
    try {
      const { username, email, deletedUser, deleteType } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 3;
      const skip = (page - 1) * limit;

      const filter = {};
      if (deletedUser === "true") {
        filter.status = 0;
        if (deleteType === "user") {
          filter.$expr = { $eq: ["$_id", { $toObjectId: "$deletedBy" }] };
        } else if (deleteType === "admin") {
          filter.$expr = { $ne: ["$_id", { $toObjectId: "$deletedBy" }] };
          filter.deletedBy = { $exists: true, $ne: null };
        }
      }

      if (username) filter.username = new RegExp(username, "i");
      if (email) filter.email = new RegExp(email, "i");

      const [users, total] = await Promise.all([
        User.aggregate([
          { $match: filter },
          {
            $lookup: {
              from: "addresses",
              localField: "_id",
              foreignField: "userId",
              as: "addressDetails",
            },
          },
          {
            $project: {
              _id: 1,
              userName: "$username",
              email: "$email",
              mobile: "$mobile",
              isVerifiedByEmail: 1,
              isVerifiedByMobile: 1,
              status: 1,
              deletedBy: 1,
              addressDetails: "$addressDetails",
            },
          },
          { $skip: skip },
          { $limit: limit },
        ]),
        User.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);
      const metaData = {
        page,
        limit,
        total,
        hasMoreData: page < totalPages,
        totalPages,
      };

      return success(res, { users, metaData }, appString.USERLISTRETRIVE, 200);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },

  activateUser: async (req, res) => {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return error(res, appString.INVALIDUSERID, 400);
      }

      const user = await User.findById(userId);

      if (!user) {
        return error(res, appString.NOT_FOUND, 404);
      }

      if (user.deletedBy && user.deletedBy.toString() === userId.toString()) {
        return error(req, res, appString.CANNOTREACTIVATE, 403);
      }

      user.status = 1;
      user.deletedBy = undefined;
      await user.save();

      return success(res, user, appString.REACTIVATE);
    } catch (err) {
      console.error("Activation Error:", err);
      return error(res, err.message, 500);
    }
  },

  deleteUser: async (req, res) => {
    try {
      const { userId } = req.params;

      const requesterId = req?.user?.id;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return error(res, appString.INVALIDUSERID, 400);
      }

      const result = await User.findOneAndUpdate(
        { _id: userId, status: 1 },
        {
          status: 0,
          deletedBy: requesterId,
        },
        { new: true },
      );

      if (!result) {
        return error(res, appString.INACTIVE, 404);
      }

      return success(res, null, appString.USER_DELETED);
    } catch (err) {
      console.error("Delete Error:", err);
      return error(res, err.message, 500);
    }
  },

  getMembershipStatus: async (req, res) => {
    try {
      const allMemberships = await UserMembership.find({});
      return success(allMemberships);
    } catch (err) {
      return console.error({ error: err.message });
    }
  },




 uploadPhotos: async (req, res) => {
    // We call the upload middleware manually here to handle Multer errors specifically
    upload(req, res, (err) => {
      try {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ message: `Multer Error: ${err.message}` });
        } else if (err) {
          return res.status(400).json({ message: err.message });
        }

        // Check if files exist
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ message: appString.UPLOAD_ATLEAST_IMAGE });
        }

        // Map the filenames to an array
        const fileNames = req.files.map((file) => file.filename);

        return res.status(200).json({
          success: true,
          message: appString.PHOTOS_UPLOADED_SUCCESSFULLY,
          data: fileNames,
        });
      } catch (error) {
        console.error("Upload Error:", error);
        return res.status(500).json({ message: appString.SEREVER_ERROR });
      }
    });
  },


};
module.exports = adminController;
