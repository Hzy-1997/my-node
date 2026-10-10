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

const hotelApiListt = require("./hotel")


// 酒店列表
router.get("/hotelList", hotelApiListt.hotelList)


//酒店房型详情
router.get("/hotelInformation", hotelApiListt.hotelInformation)


// 酒店详情

router.get("/hotelDetails", hotelApiListt.getHotelDetail)

// 购买酒店
router.post("/buyHotel", hotelApiListt.buyHotel)







module.exports = router