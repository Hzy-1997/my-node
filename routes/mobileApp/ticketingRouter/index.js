const express = require("express")
const router = express.Router()
const { checkToken } = require("../../../utils/jwt")

const ticketingList = require("./ticketing")

// 票务列表
router.get("/list", ticketingList.ticketList)
// 票务信息
router.get("/infor", ticketingList.ticketInfor)


module.exports = router