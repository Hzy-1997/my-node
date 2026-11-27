/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-17 15:47:46
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2026-11-17 15:24:33
 */
var express = require('express');
const { checkToken } = require("../utils/jwt.js")
var router = express.Router();

// ----------------------------               管理后台
// 登录 
router.use('/login', require('./managementSystem/loginRouter/index.js'))
// 用户
router.use('/user', checkToken, require('./managementSystem/userRouter/index.js'))
// 部门
router.use("/dept", checkToken, require("./managementSystem/deptRouter/index.js"))
// 角色
router.use("/role", checkToken, require("./managementSystem/roleRouter/index.js"))
// 菜单
router.use("/menu", checkToken, require("./managementSystem/menuRouter/index.js"))
// 票务管理
router.use("/ticket", require("./managementSystem/ticketingRouter/index.js"))
// 抢票功能（Redis高并发库存管理）
router.use("/ticketStock", require("./ticketRoutes.js"))
// 攻略活动
router.use("/service", require("./managementSystem/scenicManagementRouter/index.js"))
// 酒店管理
router.use("/hotel", require("./managementSystem/hotelRouter/index.js"))
// 套餐
router.use("/package", require("./managementSystem/comboRouter/index.js"))
// 预约模块
router.use("/appointment", require("./managementSystem/appointmentRouter/index.js"))
// 游客服务与意见建议  智能问答
router.use("/serviceSuggestions", require("./managementSystem/serviceRouter/index.js"))


// 支付宝支付（秒杀抢票相关）
router.use("/alipay", require("./managementSystem/payment/index.js"))
// 公共接口（支付/回调/退款，所有业务共用）
router.use("/public", require("./managementSystem/publicInterface/index.js"))
// 操作日志
router.use("/log", checkToken, require("./managementSystem/operLogRouter/index.js"))
// 字典管理
router.use("/dict", checkToken, require("./managementSystem/dictTypeRouter/index.js"))
// 联系电话管理
router.use("/contactPhone", require("./managementSystem/contactPhoneRouter/index.js"))
// 演出管理
router.use("/performance", require("./managementSystem/scenicSpotsRouter/index.js"))



// ---------------------------                小程序接口
// 登录
router.use('/wx/login', require("./mobileApp/appLoginRouter/index.js"))
//票务信息
router.use("/wx/ticket", require("./mobileApp/ticketingRouter/index.js"))
// 攻略信息
router.use("/wx/service", require("./mobileApp/scenicManagementRouter/index.js"))
// 酒店列表
router.use("/wx/hotel", require("./mobileApp/hotelRouter/index.js"))
// 酒店信息
router.use("/wx/hotelInformation", require("./mobileApp/hotelRouter/index.js"))
// 套餐信息
router.use("/wx/combo", require("./mobileApp/comboRouter/index.js"))
// 营地信息
router.use("/wx/campsite", require("./mobileApp/campsiteRouter/index.js"))
// 景区公交（班车）
router.use("/wx/scenicBus", require("./mobileApp/scenicBusRouter/index.js"))
// 停车场
router.use("/wx/parking", require("./mobileApp/parkingRouter/index.js"))
// 订阅提醒
router.use("/wx/subscribe", require("./mobileApp/subscribeRouter/index.js"))


// // 餐饮信息
// router.use("/wx/food", require("./mobileApp/foodRouter/index.js"))
// // 景区信息
// router.use("/wx/scenic", require("./mobileApp/scenicManagementRouter/index.js"))










module.exports = router;
