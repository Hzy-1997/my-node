/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-25 14:23:20
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2025-09-03 16:53:09
 */



const express = require("express")
const router = express.Router()
const { checkToken } = require("../../../utils/jwt")


const roleController = require("./role")

// 角色管理
router.post("/roleOperate", roleController.roleOperate)
// 角色列表
router.get("/roleList", roleController.getRoleList)





module.exports = router