
const express = require("express")
const router = express.Router()
const { checkToken } = require("../../../utils/jwt")

const comboController = require("./combo")

// 套餐配置
// router.post("/comboOperation", comboController.comboOperation)
// 列表
router.get("/comboList", comboController.comboList)
// 产品配置
// router.post("/productOperation", comboController.productOperation)
// 商品列表
// router.get("/productList", comboController.getProductList)
// 配置价格日期规则
// router.post("/createTicketPriceRule", comboController.createTicketPriceRule)
// 购买套餐
router.post("/buyCombo", comboController.buyCombo)
// 套餐订单信息
router.get("/comboOrderDetail", comboController.getComboOrderInfo)



module.exports = router
