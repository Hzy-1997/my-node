/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */


const express = require("express")
const router = express.Router()
const { checkToken } = require("../../../utils/jwt")

const comboController = require("./combo")

// 套餐配置
router.post("/comboOperation", comboController.comboOperation)
// 列表
router.get("/comboList", comboController.comboList)
// 产品配置
router.post("/productOperation", comboController.productOperation)
// 商品列表
router.get("/productList", comboController.getProductList)
// 配置价格日期规则
router.post("/createTicketPriceRule", comboController.createTicketPriceRule)
// 购买套餐
router.post("/buyCombo", comboController.buyCombo)



module.exports = router
