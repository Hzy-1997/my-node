/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-17 16:16:00
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2025-10-27 15:13:14
 */
const express = require('express');
const router = express.Router()

const loginList = require('./login')
const verify = require('./verify')

// 登录接口
router.post("/login", loginList.login)
// 验证接口
router.get("/verifyCode", verify.verify)

module.exports = router