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




module.exports = router