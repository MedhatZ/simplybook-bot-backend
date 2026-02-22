const express = require("express");

const router = express.Router();

router.use("/availability", require("./availability"));
router.use("/booking", require("./booking"));
router.use("/reschedule", require("./reschedule"));

module.exports = router;