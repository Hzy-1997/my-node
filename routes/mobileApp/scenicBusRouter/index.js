
const express = require("express")
const router = express.Router()

const scenicBusController = require("./scenicBus.js")

// 景区公交订单信息（列表/详情）
router.get("/orderInfo", scenicBusController.getScenicBusOrderInfo)

module.exports = router
