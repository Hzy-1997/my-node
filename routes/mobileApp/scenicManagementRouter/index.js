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


// 攻略
const strategyList = require("./strategy")

router.get("/strategyList", strategyList.strategyList)

router.get("/strategyInfo", strategyList.strategyInfo) 
router.get("/sportsInfo", strategyList.sportsInfo)
router.get("/leisureInfo", strategyList.leisureInfo)
router.get("/cateringInfo", strategyList.cateringInfo)
router.get("/shoppingInfo", strategyList.shoppingInfo)


module.exports = router