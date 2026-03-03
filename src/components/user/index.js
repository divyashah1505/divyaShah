const routeArray = require("./routes");
const middleware = require("../../middleware/index");
const router = require("express").Router();
middleware.routeArray(routeArray, router);
module.exports = router;
