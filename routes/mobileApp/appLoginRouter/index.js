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
const appLogin = require("./login")


router.post("/login", appLogin.createMember)
router.post("/loginByPhone", appLogin.loginByPhone)
router.get("/memberInfo", appLogin.getUserInfo)
router.post("/updateUserInfo", appLogin.updateUserInfo)



module.exports = router