const express = require('express');
const router = express.Router()
const { operLogMiddleware } = require("../../../utils/operLog")

const touristServices = require("./touristServices")
const opinionsFeedback = require("./opinionsFeedback")



// 旅游服务操作
router.post("/touristServicesOperation", touristServices.touristServicesOperation)
// 旅游服务列表
router.get("/touristServicesList", touristServices.touristServicesList)


// 意见反馈操作
router.post("/opinionsFeedbackOperation", opinionsFeedback.feedbackOperation)
// 意见反馈列表
router.get("/opinionsFeedbackList", opinionsFeedback.getFeedbackList)


module.exports = router
