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
const express = require('express');
const router = express.Router()

const Menu = require('./menu.js')


// 菜单接口
router.post("/operate", Menu.menuOperate)
router.get("/list", Menu.menuList)



router.post("/permissionOperate", Menu.menuPermissionOperate)
router.get("/permissionList", Menu.getPermissionList)

module.exports = router