const express = require("express");
const adminRoutesArray = require("./routes");
const { routeArray } = require("../../middleware/index");

const adminRouter = express.Router();

routeArray(adminRoutesArray, adminRouter, true);

module.exports = adminRouter;
