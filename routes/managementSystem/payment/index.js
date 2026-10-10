/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const express = require('express');
const router = express.Router();
const paymentController = require('./seckillPayment');

// 订单相关
router.post('/createOrder', paymentController.createOrder);      // 创建订单
router.get('/queryOrderList', paymentController.queryOrderList); // 查询订单列表
router.post('/exportOrder', paymentController.exportOrder); // 导出订单EXCEL


// 查询监控
router.get('/status', paymentController.getQueueStatus);   // 查询队列状态
router.get('/stock', paymentController.getRealTimeStock); // 查询实时库存

// 库存重置
router.post('/dailyReset', paymentController.dailyResetAPI); // 手动触发每日库存重置

// 退款列表查询（退款 payment/notify/refund 三个接口已迁移到 publicInterface/index.js）
router.get('/refundList', paymentController.refundList); // 查询退款订单列表



// 选座功能
router.get('/seats/:ticketId', paymentController.getSeatMap); // 获取座位图及实时状态
router.post('/seats/lock', paymentController.lockSeat); // 实时锁定座位
router.post('/seats/unlock', paymentController.unlockSeat); // 取消单个座位锁定
router.post('/seats/release-all', paymentController.releaseAllSeats); // 释放所有座位（换座）

module.exports = router;
