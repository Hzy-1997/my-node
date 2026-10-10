/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-24 10:09:39
 * @LastEditors: sueRimn
 * @LastEditTime: 2025-07-24 16:57:15
 */

const express = require("express")
const router = express.Router()
const { checkToken } = require("../../../utils/jwt")

const deptController = require("./dept")

//部门操作
router.post("/deptOperate", deptController.deptOperate)
//部门列表
router.get("/deptList", deptController.deptList)



module.exports = router
