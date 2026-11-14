const express = require('express');
const router = express.Router()
const { operLogMiddleware } = require("../../../utils/operLog")

const touristServices = require("./touristServices")
const serviceFacility = require("./serviceFacility")
const opinionsFeedback = require("./opinionsFeedback")
const questionsAnswers = require("./questionsAnswers")



// 旅游服务操作
router.post("/touristServicesOperation", touristServices.touristServicesOperation)
// 旅游服务列表
router.get("/touristServicesList", touristServices.touristServicesList)


// 服务设施操作（创建/更新/删除）
router.post("/serviceFacilityOperation", serviceFacility.serviceFacilityOperation)
// 服务设施列表
router.get("/serviceFacilityList", serviceFacility.serviceFacilityList)


// 意见反馈操作
router.post("/opinionsFeedbackOperation", opinionsFeedback.feedbackOperation)
// 意见反馈列表
router.get("/opinionsFeedbackList", opinionsFeedback.getFeedbackList)


// 智能问答操作（创建/更新/删除）
router.post('/operationQuestionsAnswers', questionsAnswers.operationQuestionsAnswers)
// 智能问答列表
router.get('/questionsAnswersList', questionsAnswers.questionsQuestionsAnswersList)
// 智能问答详情
router.post('/questionsAnswersDetail', questionsAnswers.questionsAnswersDetail)


module.exports = router
