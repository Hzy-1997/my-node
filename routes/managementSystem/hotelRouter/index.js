/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const express = require('express');
const router = express.Router()
const { operLogMiddleware } = require("../../../utils/operLog")
const hotelInterface = require("./hotel")


// 酒店操作接口
router.post('/hotelOperation', operLogMiddleware({ title: '酒店操作', businessType: '操作' }), hotelInterface.hotelListOperation)
// 获取酒店列表
router.get('/getHotelList', operLogMiddleware({ title: '酒店列表', businessType: '查询' }), hotelInterface.getHotelList)


// 房型操作接口
router.post('/roomOperation', hotelInterface.hotelRoomTypeOperation)
// 获取房型列表
router.get('/roomTypeList', hotelInterface.getRoomTypeList)



// 套餐操作接口
router.post('/packageOperation', hotelInterface.hotelPackageOperation)
// 获取套餐列表
router.get('/packageList', hotelInterface.getRoomPackageList)



// 日期价格操作接口
router.post('/priceOperation', hotelInterface.setDatePrice)
// 获取规则信息
router.get('/getPriceRule', hotelInterface.getPriceRule)

// 查询日期价格
router.get('/getDatePrice', hotelInterface.getDatePrice)
// 修改单个价格日期
router.post('/updateDatePrice', hotelInterface.updateDatePrice)

// 预定房型接口
router.post('/hotelRoomBook', hotelInterface.hotelRoomBook)

// 酒店订单列表
router.get('/hotelOrderList', hotelInterface.getHotelOrderList)
// 导出酒店订单列表EXCEL
router.post('/exportHotelOrderList', hotelInterface.exportHotelOrderList)

// 酒店核销员操作（创建/更新/删除）
router.post('/hotelWriteOffOperate', hotelInterface.hotelWriteOffOperate)
// 酒店核销员列表
router.get('/hotelWriteOffList', hotelInterface.getHotelWriteOffList)


// 酒店订单核销（核销码核销）
router.post('/hotelVerifyOrder', hotelInterface.hotelVerifyOrder)
// 核销码查询订单（核销前预览）
router.get('/hotelQueryByVerifyCode', hotelInterface.hotelQueryByVerifyCode)


// 酒店退款订单列表
router.get('/hotelRefundList', hotelInterface.getHotelRefundList)
// 酒店退款预览（计算扣款规则和退款金额，不修改状态）
router.get('/hotelRefundPreview', hotelInterface.hotelRefundPreview)


module.exports = router