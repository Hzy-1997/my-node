

const express = require('express');
const router = express.Router();
const { operLogMiddleware } = require("../../../utils/operLog")
const publicInterface = require('./publicInterface');



// 公共支付宝接口（所有业务共用）
router.post('/payment', publicInterface.payment);   // 发起支付
router.post('/notify', publicInterface.notify);       // 支付宝回调
router.post('/refund', publicInterface.refund);       // 支付宝退款
router.get('/queryPayStatus', publicInterface.queryPayStatus);  // 主动查询补单（returnUrl 跳回时调）

// 公共图片操作（所有业务共用）
router.post('/uploadImg', publicInterface.uploadImg)   // 上传图片专用
router.post('/deleteImg', publicInterface.deleteImg)  // 点击删除图片




module.exports = router;