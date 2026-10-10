/*
 * @描述:
 * @版本:
 * @作者:
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const express = require("express");
const router = express.Router();
const { checkToken } = require("../../../utils/jwt");

const ticketingList = require("./ticketing");

// 票务操作
router.post("/operate", ticketingList.ticketOperate);
// 票务列表
router.get("/list", ticketingList.ticketList);

// 座位管理
router.post("/seatManage", ticketingList.seatManage);
// 座位列表
router.get("/getSeatList", ticketingList.getSeatList);

// 票务价格操作
router.post("/operatePrice", ticketingList.operatePrice);
// 票务日期价格（日历预览）
router.get("/getTicketDatePrices", ticketingList.getTicketDatePrices);
// router.get("/getPartyData", ticketingList.getThirdPartyData)

// 票务核销员操作
router.post("/writeOffOperate", ticketingList.writeOff);
router.get("/writeOffList", ticketingList.writeOffList);

module.exports = router;
