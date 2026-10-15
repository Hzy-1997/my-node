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
const multer = require("multer")
const appLogin = require("./login")

// 内存存储，req.file.buffer 可直接使用
const upload = multer()

// 登录接口
router.post("/login", appLogin.createMember) 
// 手机号一键登录
router.post("/loginByPhone", appLogin.loginByPhone)
// 获取用户信息
router.get("/memberInfo", appLogin.getUserInfo)
// 更新用户信息
router.post("/updateUserInfo", appLogin.updateUserInfo)
// 身份证照片识别（字段名 file 与前端 wx.uploadFile 的 name 一致）
router.post("/recognizeIdCard", upload.single("file"), appLogin.recognizeIdCard)




module.exports = router