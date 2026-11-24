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

const performance = require("./performance")


// 演出操作（创建/更新/删除）
router.post("/performanceOperation", performance.performance)
// 演出列表
router.get("/performanceList", performance.performanceList)
// 演出节目详情
router.get("/performanceDetail", performance.performanceDetail)
// 演出场次操作（创建/批量创建/更新/删除/清空某天）
router.post("/performanceScheduleOperation", performance.performanceSchedule)
// 演出场次列表
router.get("/performanceScheduleList", performance.performanceScheduleList)


module.exports = router
