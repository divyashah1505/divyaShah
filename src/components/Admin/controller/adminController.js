const Admin = require("../model/admin");
const User = require("../../user/model/users");
const { generateTokens, success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");
const mongoose = require("mongoose");
const category = require("../model/category");
const user = require("../../user/model/users")
// const userMembership = require("../../user/model/userMembership");
const UserMembership = require("../../user/model/userMembership");
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
  }
};
module.exports = adminController;
