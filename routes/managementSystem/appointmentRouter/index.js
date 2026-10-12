/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const express = require("express")
const router = express.Router()
const { checkToken } = require("../../../utils/jwt")


const campsiteInterface = require("./campsite")
const parkingInterface = require("./parking")
const scenicBusInterface = require("./scenicBus")


// 夏令营
router.post("/campsiteOperation", campsiteInterface.campsiteOperation)
router.get("/campsiteList", campsiteInterface.getCampsiteList)
router.post("/campsiteOperate", campsiteInterface.campsiteOperate)

// 夏令营期数
router.post("/campsiteSessionList", campsiteInterface.getCampsiteSessionList)
router.post("/campsiteAppointment", campsiteInterface.campsiteAppointment)

// 夏令营票档
router.post("/campsiteTicketOperation", campsiteInterface.ticketTypeOperation)
router.post("/campsiteTicketList", campsiteInterface.getCampsiteTicketList)

// 夏令营详情
router.get("/campsiteDetail", campsiteInterface.getCampsiteDetail)
// 期数详情
router.get("/campsiteSessionDetail", campsiteInterface.getCampsiteSessionDetail)



// 停车场
router.post("/parkingOperation", parkingInterface.parkingOperation)
router.get("/parkingList", parkingInterface.parkingList)
router.post("/parkingAppointment", parkingInterface.parkingAppointment)
router.get("/parkingDetail", parkingInterface.parkingDetail)

// 停车场车位
router.get("/parkingSpots", parkingInterface.parkingSpots)
router.post("/parkingSpotOperation", parkingInterface.parkingSpotOperation)


// 景区公交商品
router.post("/scenicBusOperation", scenicBusInterface.scenicBusOperation)
router.get("/scenicBusList", scenicBusInterface.scenicBusList)
router.get("/scenicBusDetail", scenicBusInterface.scenicBusDetail)

// 景区公交购票（一单多票、一票一码）
router.post("/scenicBusAppointment", scenicBusInterface.scenicBusAppointment)
router.post("/scenicBusPay", scenicBusInterface.scenicBusPay) // 支付（占位，待接入支付渠道）

// 景区公交订单
router.get("/scenicBusOrderList", scenicBusInterface.scenicBusOrderList)
router.get("/scenicBusOrderDetail", scenicBusInterface.scenicBusOrderDetail)

// 车票核销与退票（以"票"为单位，单张核销/单张退票）
router.post("/scenicBusVerify", scenicBusInterface.scenicBusVerify)
router.post("/scenicBusRefund", scenicBusInterface.scenicBusRefund)




module.exports = router