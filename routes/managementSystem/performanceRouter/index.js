const express = require('express');
const router = express.Router()

const performance = require("./performance")


// 演出操作（创建/更新/删除）
router.post("/performanceOperation", performance.performance)
// 演出列表
router.get("/performanceList", performance.performanceList)
// 演出场次操作（创建/批量创建/更新/删除/清空某天）
router.post("/performanceScheduleOperation", performance.performanceSchedule)
// 演出场次列表
router.get("/performanceScheduleList", performance.performanceScheduleList)


module.exports = router
