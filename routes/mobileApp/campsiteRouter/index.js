
const express = require("express")
const router = express.Router()

const campsiteController = require("./campsite.js")

// 夏令营订单信息（列表/详情）
router.get("/campOrderInfo", campsiteController.getCampOrderInfo)

module.exports = router
