
const express = require("express")
const router = express.Router()

const parkingController = require("./parking.js")

// 停车场预约订单信息（列表/详情）
router.get("/orderInfo", parkingController.getParkingOrderInfo)

module.exports = router
