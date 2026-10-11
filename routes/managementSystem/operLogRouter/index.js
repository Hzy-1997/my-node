/*
 * @描述: 操作日志路由
 * @版本: 
 * @作者: 
 * @日期: 2026-03-28
 */

const express = require('express');
const router = express.Router();
const operLogController = require('./operLog');
const { checkToken } = require('../../../utils/jwt');

// 所有操作日志接口都需要登录
router.use(checkToken);

// 获取操作日志列表
router.get('/list', operLogController.getOperLogList);

// 获取操作日志详情
router.get('/detail', operLogController.getOperLogDetail);

// 删除操作日志
router.delete('/delete', operLogController.deleteOperLog);

// 批量删除操作日志
router.post('/batchDelete', operLogController.batchDeleteOperLog);

// 清空操作日志
router.delete('/clear', operLogController.clearOperLog);

module.exports = router;
