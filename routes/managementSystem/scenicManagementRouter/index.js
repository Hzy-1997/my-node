

const express = require("express")
const router = express.Router()
const { checkToken } = require("../../../utils/jwt")



const serviceModule = require("./strategy")

// 攻略
router.post("/strategyOperate", serviceModule.strategyOperate)
router.get("/strategyList", serviceModule.strategyList)

// 运动
router.post("/sportsOperate", serviceModule.sportsOperation)
router.get("/sportsList", serviceModule.getFitnessExerciseList)

// 休闲
router.post("/leisureOperate", serviceModule.leisureOperation)
router.get("/leisureList", serviceModule.getLeisureList)

// 餐饮
router.post("/cateringOperate", serviceModule.cateringOperations)
router.get("/cateringList", serviceModule.getRestaurantList)

// 购物
router.post("/shoppingOperate", serviceModule.shoppingOperations)
router.get("/shoppingList", serviceModule.getShoppingList)






module.exports = router