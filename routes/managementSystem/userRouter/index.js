/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-22 10:06:27
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2025-11-07 10:34:51
 */

const express = require('express');
const router = express.Router()
const { checkToken } = require("../../../utils/jwt")
const userController = require('./user')

router.post('/userOperate', userController.register)
router.post('/batchDelete', userController.batchDelete)
router.get('/list', userController.list)
router.get('/getUserPermissions', userController.getUserPermissions)

module.exports = router